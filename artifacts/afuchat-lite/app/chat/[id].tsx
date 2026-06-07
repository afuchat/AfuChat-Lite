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
import { OfflineBanner } from "@/components/OfflineBanner";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";
import { Message, Profile, supabase } from "@/lib/supabase";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

function Bubble({
  message,
  isMine,
  isGroup,
  colors,
}: {
  message: Message;
  isMine: boolean;
  isGroup: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[bubbleStyles.row, isMine ? bubbleStyles.rowRight : bubbleStyles.rowLeft]}>
      <View
        style={[
          bubbleStyles.bubble,
          isMine
            ? [bubbleStyles.mineBubble, { backgroundColor: colors.myBubble }]
            : [bubbleStyles.theirBubble, { backgroundColor: colors.theirBubble }],
          message.pending && bubbleStyles.pendingOpacity,
        ]}
      >
        {!isMine && isGroup && message.sender && (
          <Text style={[bubbleStyles.senderName, { color: colors.primary }]}>
            {(message.sender as Profile).display_name ||
              `@${(message.sender as Profile).handle}`}
          </Text>
        )}
        <Text
          style={[
            bubbleStyles.content,
            { color: isMine ? colors.myBubbleText : colors.theirBubbleText },
          ]}
        >
          {message.encrypted_content}
        </Text>
        <View style={bubbleStyles.meta}>
          <Text
            style={[
              bubbleStyles.time,
              {
                color: isMine
                  ? "rgba(255,255,255,0.6)"
                  : colors.mutedForeground,
              },
            ]}
          >
            {formatTime(message.sent_at)}
          </Text>
          {isMine && (
            message.failed ? (
              <Feather name="alert-circle" size={11} color="#EF4444" />
            ) : message.pending ? (
              <Feather name="clock" size={11} color="rgba(255,255,255,0.5)" />
            ) : (
              <Feather name="check" size={11} color="rgba(255,255,255,0.7)" />
            )
          )}
        </View>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 2, paddingHorizontal: 14 },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 7,
    borderRadius: 20,
  },
  mineBubble: {
    borderBottomRightRadius: 4,
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  theirBubble: { borderBottomLeftRadius: 4 },
  pendingOpacity: { opacity: 0.6 },
  senderName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  content: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 3,
  },
  time: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

export default function ChatScreen() {
  const { id, name, isGroup, avatarUrl } = useLocalSearchParams<{
    id: string;
    name: string;
    isGroup: string;
    avatarUrl?: string;
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

  const mounted = useRef(true);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGroupChat = isGroup === "1";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error: qErr } = await supabase
        .from("messages")
        .select(
          "id, chat_id, sender_id, encrypted_content, sent_at, delivered_at, read_at, reply_to_message_id, attachment_url, attachment_type, sender:profiles!messages_sender_id_fkey(id, display_name, handle, avatar_url, last_seen, is_verified)"
        )
        .eq("chat_id", id)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (qErr) throw qErr;
      if (mounted.current) { setMessages((data as unknown as Message[]) ?? []); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load messages");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMessages();
    if (!id || !user) return;

    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${id}` },
        (payload) => {
          if (!mounted.current) return;
          const msg = payload.new as Message;
          setMessages((prev) => {
            const without = prev.filter((m) => !m.local_id || m.local_id !== (msg as any).local_id);
            return [{ ...msg, pending: false }, ...without];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `chat_id=eq.${id}`,
        },
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
            if (mounted.current && p)
              setTypingName((p as Profile).display_name || `@${(p as Profile).handle}`);
          } else {
            if (mounted.current) setTypingName(null);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user, loadMessages]);

  const onChangeText = (val: string) => {
    setText(val);
    if (!user || !id) return;

    supabase
      .from("typing_indicators")
      .upsert(
        { chat_id: id, user_id: user.id, is_typing: true, started_at: new Date().toISOString() },
        { onConflict: "chat_id,user_id" }
      )
      .then(() => {});

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      supabase
        .from("typing_indicators")
        .upsert(
          { chat_id: id, user_id: user.id, is_typing: false },
          { onConflict: "chat_id,user_id" }
        )
        .then(() => {});
    }, 3000);
  };

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || !user || !id) return;
    setText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    supabase
      .from("typing_indicators")
      .upsert(
        { chat_id: id, user_id: user.id, is_typing: false },
        { onConflict: "chat_id,user_id" }
      )
      .then(() => {});

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();

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

  const canSend = text.trim().length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: name ?? "Chat",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
          headerShadowVisible: false,
          headerRight: () => (
            <Avatar
              uri={avatarUrl || undefined}
              name={name ?? "?"}
              size={34}
              style={{ marginRight: 12 }}
            />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.background }]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <OfflineBanner />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              Loading messages…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <View style={[styles.stateIcon, { backgroundColor: colors.muted }]}>
              <Feather name="alert-circle" size={28} color={colors.destructive} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>
              Could not load
            </Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              {error}
            </Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={loadMessages}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <Bubble
                message={item}
                isMine={item.sender_id === user?.id}
                isGroup={isGroupChat}
                colors={colors}
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
                <View style={[styles.stateIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="message-circle" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.stateTitle, { color: colors.foreground }]}>
                  Start the conversation
                </Text>
                <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                  Say hello! 👋
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
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder="Type a message…"
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
                backgroundColor: canSend ? colors.primary : colors.muted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={sendMessage}
            disabled={!canSend || sending}
          >
            <Feather
              name="send"
              size={18}
              color={canSend ? "#fff" : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  stateText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  messageList: { paddingVertical: 14, flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 80,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
    lineHeight: 21,
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
