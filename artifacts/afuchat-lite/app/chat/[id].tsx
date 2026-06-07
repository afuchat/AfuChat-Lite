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
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";
import { ChatMessage, supabase } from "@/lib/supabase";

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOnline, queueMessage } = useOffline();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("chat_messages")
      .select("*, sender:profiles!sender_id(id, display_name, handle, avatar_url)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (data) setMessages(data as unknown as ChatMessage[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            const filtered = prev.filter(
              (m) => !m.local_id || m.local_id !== newMsg.local_id
            );
            return [{ ...newMsg, pending: false }, ...filtered];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, fetchMessages]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || !user || !id) return;

    setText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const localId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const optimistic: ChatMessage = {
      id: localId,
      conversation_id: id,
      sender_id: user.id,
      content,
      is_read: false,
      local_id: localId,
      created_at: now,
      pending: true,
    };
    setMessages((prev) => [optimistic, ...prev]);

    if (!isOnline) {
      await queueMessage({
        localId,
        conversationId: id,
        senderId: user.id,
        content,
        createdAt: now,
      });
      return;
    }

    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content,
      local_id: localId,
    });

    if (!error) {
      await supabase
        .from("conversations")
        .update({ last_message: content, last_message_at: now })
        .eq("id", id);
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.local_id === localId ? { ...m, pending: false, failed: true } : m
        )
      );
    }
    setSending(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: name || "Chat",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: {
            fontFamily: "Inter_600SemiBold",
            fontSize: 17,
          },
          headerRight: () => <Avatar name={name || "?"} size={32} />,
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
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <Feather name="message-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No messages yet. Say hello!
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMine={item.sender_id === user?.id}
                senderName={
                  (item.sender as any)?.display_name ||
                  `@${(item.sender as any)?.handle}`
                }
              />
            )}
            inverted
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input Bar */}
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
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
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
