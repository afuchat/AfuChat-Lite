import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatListItem } from "@/components/ChatListItem";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Chat, Message, Profile, getDisplayName, supabase } from "@/lib/supabase";

type ChatRow = {
  chat: Chat;
  otherUser: Profile | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Get all chat IDs where I'm a member
      const { data: memberships, error: memErr } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      if (memErr) throw memErr;
      if (!memberships?.length) {
        if (mounted.current) { setRows([]); setError(null); }
        return;
      }

      const chatIds = memberships.map((m) => m.chat_id);

      // 2. Get the chats
      const { data: chats, error: chatErr } = await supabase
        .from("chats")
        .select("*")
        .in("id", chatIds)
        .eq("is_channel", false)
        .order("updated_at", { ascending: false });

      if (chatErr) throw chatErr;

      // 3. Enrich each chat
      const enriched: ChatRow[] = await Promise.all(
        (chats ?? []).map(async (chat: Chat) => {
          // Find other user for 1-on-1
          let otherUser: Profile | null = null;
          if (!chat.is_group) {
            const { data: others } = await supabase
              .from("chat_members")
              .select("user_id")
              .eq("chat_id", chat.id)
              .neq("user_id", user.id)
              .limit(1);

            if (others?.length) {
              const { data: p } = await supabase
                .from("profiles")
                .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
                .eq("id", others[0].user_id)
                .single();
              otherUser = (p as Profile) ?? null;
            }
          }

          // Latest message
          const { data: msgs } = await supabase
            .from("messages")
            .select("encrypted_content, sent_at")
            .eq("chat_id", chat.id)
            .order("sent_at", { ascending: false })
            .limit(1);

          const lastMsg = msgs?.[0] ?? null;

          return {
            chat,
            otherUser,
            lastMessage: lastMsg?.encrypted_content ?? null,
            lastMessageAt: lastMsg?.sent_at ?? chat.updated_at,
          };
        })
      );

      // Sort by most recent message
      enriched.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      if (mounted.current) { setRows(enriched); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load chats");
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, [user]);

  useEffect(() => {
    loadChats();

    // Realtime — refresh when messages arrive or chats change
    const channel = supabase
      .channel("chats-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, loadChats)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, loadChats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadChats]);

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Chats</Text>
        <Pressable
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/contacts");
          }}
        >
          <Feather name="edit" size={18} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading chats…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={loadChats}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Feather name="message-circle" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No conversations yet
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Go to People to start your first chat
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.chat.id}
          renderItem={({ item }) => (
            <ChatListItem
              chat={item.chat}
              otherUser={item.otherUser}
              lastMessage={item.lastMessage}
              lastMessageAt={item.lastMessageAt}
              onPress={() => {
                Haptics.selectionAsync();
                router.push({
                  pathname: "/chat/[id]",
                  params: {
                    id: item.chat.id,
                    name: item.chat.is_group
                      ? item.chat.name ?? "Group"
                      : getDisplayName(item.otherUser),
                    isGroup: item.chat.is_group ? "1" : "0",
                  },
                });
              }}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  newBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 80 },
});
