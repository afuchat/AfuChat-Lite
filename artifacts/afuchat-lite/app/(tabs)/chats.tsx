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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useUnread } from "@/context/UnreadContext";
import { useColors } from "@/hooks/useColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  Chat,
  Profile,
  getDisplayName,
  isOnline as profileOnline,
  supabase,
} from "@/lib/supabase";

type ChatRow = {
  chat: Chat;
  otherUser: Profile | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  typingName: string | null;
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
  }
  if (diff < 604_800_000)
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { setTotalUnread } = useUnread();

  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingMap, setTypingMap] = useState<Map<string, string>>(new Map());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
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

      const [chatsResult, membersResult, messagesResult] = await Promise.all([
        supabase
          .from("chats")
          .select("*")
          .in("id", chatIds)
          .eq("is_channel", false)
          .order("updated_at", { ascending: false }),
        supabase
          .from("chat_members")
          .select("chat_id, user_id")
          .in("chat_id", chatIds)
          .neq("user_id", user.id),
        supabase
          .from("messages")
          .select("chat_id, encrypted_content, sent_at, sender_id")
          .in("chat_id", chatIds)
          .order("sent_at", { ascending: false })
          .limit(Math.max(chatIds.length * 5, 50)),
      ]);

      if (chatsResult.error) throw chatsResult.error;

      const chats = chatsResult.data ?? [];
      const allMembers = membersResult.data ?? [];
      const allMessages = messagesResult.data ?? [];

      // Load last-read timestamps from AsyncStorage (set when user opens a chat)
      const lastReadEntries = await AsyncStorage.multiGet(
        chatIds.map((id) => `lastRead:${id}`)
      );
      const lastReadMap = new Map<string, number>(
        lastReadEntries
          .filter(([, val]) => val !== null)
          .map(([key, val]) => [key.replace("lastRead:", ""), new Date(val!).getTime()])
      );

      // Seal the "already read" baseline for any chat never opened on this device.
      // Without this, all historic messages default to unread (lastReadAt = 0).
      const now = new Date().toISOString();
      const unseenKeys: [string, string][] = chatIds
        .filter((cid) => !lastReadMap.has(cid))
        .map((cid) => [`lastRead:${cid}`, now]);
      if (unseenKeys.length > 0) {
        await AsyncStorage.multiSet(unseenKeys);
        unseenKeys.forEach(([key]) =>
          lastReadMap.set(key.replace("lastRead:", ""), Date.now())
        );
      }

      const otherUserIds = [...new Set(allMembers.map((m) => m.user_id))];
      const { data: profiles } = otherUserIds.length
        ? await supabase
            .from("profiles")
            .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
            .in("id", otherUserIds)
        : { data: [] as Profile[] };

      const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]));
      const memberMap = new Map<string, string>();
      for (const m of allMembers) {
        if (!memberMap.has(m.chat_id)) memberMap.set(m.chat_id, m.user_id);
      }

      // Group messages by chat for last-message and unread counting
      const msgsByChatId = new Map<string, typeof allMessages>();
      for (const msg of allMessages) {
        const list = msgsByChatId.get(msg.chat_id) ?? [];
        list.push(msg);
        msgsByChatId.set(msg.chat_id, list);
      }

      const enriched: ChatRow[] = chats.map((chat: Chat) => {
        const otherId = memberMap.get(chat.id);
        const otherUser = otherId ? (profileMap.get(otherId) ?? null) : null;
        const chatMsgs = msgsByChatId.get(chat.id) ?? [];
        const last = chatMsgs[0] ?? null; // already ordered desc

        // Unread = messages from others sent AFTER lastRead timestamp
        const lastReadAt = lastReadMap.get(chat.id) ?? 0;
        const unreadCount = chatMsgs.filter(
          (m) => m.sender_id !== user.id && new Date(m.sent_at).getTime() > lastReadAt
        ).length;

        return {
          chat,
          otherUser,
          lastMessage: last?.encrypted_content ?? null,
          lastMessageAt: last?.sent_at ?? chat.updated_at,
          unreadCount,
          typingName: typingMap.get(chat.id) ?? null,
        };
      });

      enriched.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      const total = enriched.reduce((sum, r) => sum + r.unreadCount, 0);
      if (mounted.current) { setRows(enriched); setError(null); setTotalUnread(total); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load chats");
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, [user, typingMap]);

  // Real-time: messages + typing
  useEffect(() => {
    loadChats();

    const ch = supabase
      .channel("chats-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, loadChats)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, loadChats)
      .on("postgres_changes", { event: "*", schema: "public", table: "typing_indicators" },
        async (payload) => {
          if (!mounted.current || !user) return;
          const row = payload.new as { chat_id: string; user_id: string; is_typing: boolean };
          if (row.user_id === user.id) return;
          if (row.is_typing) {
            const { data: p } = await supabase
              .from("profiles")
              .select("display_name, handle")
              .eq("id", row.user_id)
              .single();
            if (mounted.current && p) {
              const name = (p as Profile).display_name || `@${(p as Profile).handle}`;
              setTypingMap((prev) => new Map(prev).set(row.chat_id, name));
              setTimeout(() => {
                if (mounted.current)
                  setTypingMap((prev) => {
                    const next = new Map(prev);
                    next.delete(row.chat_id);
                    return next;
                  });
              }, 5000);
            }
          } else {
            if (mounted.current)
              setTypingMap((prev) => {
                const next = new Map(prev);
                next.delete(row.chat_id);
                return next;
              });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadChats]);

  // Merge typing state into rows reactively
  const displayRows = rows.map((r) => ({
    ...r,
    typingName: typingMap.get(r.chat.id) ?? null,
  }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerBrand}>
          <AfuChatLogo size={30} />
          <Text style={[styles.appTitle, { color: colors.foreground }]}>AfuChat Lite</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={[styles.stateIcon, { backgroundColor: colors.muted }]}>
            <Feather name="alert-circle" size={28} color={colors.destructive} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>Something went wrong</Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadChats}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : displayRows.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.stateIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="message-circle" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>No conversations yet</Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            Tap + to start your first chat
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayRows}
          keyExtractor={(item) => item.chat.id}
          renderItem={({ item }) => {
            const title = item.chat.is_group
              ? (item.chat.name ?? "Group Chat")
              : getDisplayName(item.otherUser);
            const online = !item.chat.is_group && profileOnline(item.otherUser);

            return (
              <TouchableOpacity
                style={[styles.chatRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: "/chat/[id]",
                    params: {
                      id: item.chat.id,
                      name: title,
                      isGroup: item.chat.is_group ? "1" : "0",
                      avatarUrl: item.otherUser?.avatar_url ?? "",
                      otherId: item.otherUser?.id ?? "",
                      isVerified: item.otherUser?.is_verified ? "1" : "0",
                    },
                  });
                }}
                activeOpacity={0.7}
              >
                <Avatar uri={item.otherUser?.avatar_url} name={title} size={52} isOnline={online} />
                <View style={styles.chatInfo}>
                  <View style={styles.chatTopRow}>
                    <View style={styles.chatNameWrap}>
                      <Text style={[styles.chatName, { color: colors.foreground }]} numberOfLines={1}>
                        {title}
                      </Text>
                      {!item.chat.is_group && item.otherUser?.is_verified && (
                        <VerifiedBadge size={14} />
                      )}
                    </View>
                    <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>
                      {formatTime(item.lastMessageAt)}
                    </Text>
                  </View>
                  <View style={styles.chatBottomRow}>
                    {item.typingName ? (
                      <Text style={[styles.chatPreview, { color: colors.primary, flex: 1 }]} numberOfLines={1}>
                        {item.typingName} is typing…
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.chatPreview,
                          {
                            color: item.unreadCount > 0 ? colors.foreground : colors.mutedForeground,
                            fontFamily: item.unreadCount > 0 ? "Inter_600SemiBold" : "Inter_400Regular",
                            flex: 1,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.lastMessage ?? "Tap to open conversation"}
                      </Text>
                    )}
                    {item.unreadCount > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.unreadText}>
                          {item.unreadCount > 99 ? "99+" : item.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { setRefreshing(true); loadChats(); }}
          refreshing={refreshing}
        />
      )}

      {/* FAB — new chat */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 86 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/new-chat");
        }}
      >
        <Feather name="edit-2" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  stateText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatInfo: { flex: 1, gap: 4 },
  chatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatNameWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 },
  chatName: { fontSize: 16, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  chatTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chatPreview: { fontSize: 14, lineHeight: 18 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
});
