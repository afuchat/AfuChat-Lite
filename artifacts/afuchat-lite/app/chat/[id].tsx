import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { MessageBubble } from "@/components/MessageBubble";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";
import { Message, Profile, supabase } from "@/lib/supabase";

export default function ChatScreen() {
  const { id, name, isGroup } = useLocalSearchParams<{
    id: string;
    name: string;
    isGroup: string;
  }>();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOnline, queueMessage } = useOffline();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const mounted = useRef(true);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGroupChat = isGroup === "1";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ─── Load messages ────────────────────────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error: qErr } = await supabase
        .from("messages")
        .select("*, sender:profiles!messages_sender_id_fkey(id, display_name, handle, avatar_url, last_seen, is_verified)")
        .eq("chat_id", id)
        .order("sent_at", { ascending: false })
        .limit(80);

      if (qErr) throw qErr;
      if (mounted.current) { setMessages((data as unknown as Message[]) ?? []); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load messages");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [id]);

  // ─── Realtime subscriptions ───────────────────────────────────────────────

  useEffect(() => {
    loadMessages();

    if (!id || !user) return;

    const channel = supabase
      .channel(`chat-room-${id}`)
      // New messages
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${id}` },
        (payload) => {
          if (!mounted.current) return;
          const incoming = payload.new as Message;
          setMessages((prev) => {
            // Remove our own optimistic copy if local_id matches
            const filtered = prev.filter(
              (m) => !m.local_id || m.local_id !== incoming.local_id
            );
            return [{ ...incoming, pending: false }, ...filtered];
          });
        }
      )
      // Typing indicators
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_indicators", filter: `chat_id=eq.${id}` },
        async (payload) => {
          if (!mounted.current) return;
          const row = payload.new as { user_id: string; is_typing: boolean };
          if (row.user_id === user.id) return;

          if (row.is_typing) {
            const { data: p } = await supabase
              .from("profiles")
              .select("display_name, handle")
              .eq("id", row.user_id)
              .single();
            if (mounted.current && p) {
              setTypingName((p as Profile).display_name || `@${(p as Profile).handle}`);
            }
          } else {
            if (mounted.current) setTypingName(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user, loadMessages]);

  // ─── Typing indicator emit ────────────────────────────────────────────────

  const onChangeText = (val: string) => {
    setText(val);
    if (!user || !id) return;

    // Upsert typing = true
    supabase.from("typing_indicators").upsert(
      { chat_id: id, user_id: user.id, is_typing: true, started_at: new Date().toISOString() },
      { onConflict: "chat_id,user_id" }
    ).then(() => {});

    // Auto-clear after 3 s of inactivity
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      supabase.from("typing_indicators").upsert(
        { chat_id: id, user_id: user.id, is_typing: false },
        { onConflict: "chat_id,user_id" }
      ).then(() => {});
    }, 3000);
  };

  // ─── Send message ─────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || !user || !id) return;

    setText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Clear typing
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    supabase.from("typing_indicators").upsert(
      { chat_id: id, user_id: user.id, is_typing: false },
      { onConflict: "chat_id,user_id" }
    ).then(() => {});

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Optimistic message
    const optimistic: Message = {
      id: localId,
      chat_id: id,
      sender_id: user.id,
      encrypted_content: content,
      sent_at: now,
      delivered_at: null,
      read_at: null,
      reply_to_message_id: null,
      attachment_url: null,
      attachment_type: null,
      pending: true,
      local_id: localId,
    };
    setMessages((prev) => [optimistic, ...prev]);

    if (!isOnline) {
      await queueMessage({ localId, chatId: id, senderId: user.id, content, sentAt: now });
      return;
    }

    setSending(true);
    try {
      const { error: sendErr } = await supabase.from("messages").insert({
        chat_id: id,
        sender_id: user.id,
        encrypted_content: content,
      });

      if (sendErr) throw sendErr;

      // Update chat updated_at so it sorts to top
      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch {
      if (mounted.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.local_id === localId ? { ...m, pending: false, failed: true } : m
          )
        );
      }
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: name || "Chat",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
          headerShadowVisible: false,
          headerRight: () => <Avatar name={name || "?"} size={32} style={{ marginRight: 8 }} />,
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <OfflineBanner />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={36} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadMessages}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMine={item.sender_id === user?.id}
                isGroup={isGroupChat}
              />
            )}
            inverted
            contentContainerStyle={styles.messageList}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              typingName ? <TypingIndicator name={typingName} /> : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Feather name="message-circle" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No messages yet. Say hello!
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border },
            ]}
            placeholder="Message…"
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={onChangeText}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            <Feather
              name="send"
              size={18}
              color={text.trim() ? "#fff" : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  messageList: { paddingVertical: 12, flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
});
