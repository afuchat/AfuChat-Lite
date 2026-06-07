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
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Chat, Profile, getDisplayName, isOnline as profileOnline, supabase } from "@/lib/supabase";

type ChatRow = {
  chat: Chat;
  otherUser: Profile | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: boolean;
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

      const { data: chats, error: chatErr } = await supabase
        .from("chats")
        .select("*")
        .in("id", chatIds)
        .eq("is_channel", false)
        .order("updated_at", { ascending: false });

      if (chatErr) throw chatErr;

      const enriched: ChatRow[] = await Promise.all(
        (chats ?? []).map(async (chat: Chat) => {
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

          const { data: msgs } = await supabase
            .from("messages")
            .select("encrypted_content, sent_at, sender_id")
            .eq("chat_id", chat.id)
            .order("sent_at", { ascending: false })
            .limit(1);

          const last = msgs?.[0] ?? null;

          return {
            chat,
            otherUser,
            lastMessage: last?.encrypted_content ?? null,
            lastMessageAt: last?.sent_at ?? chat.updated_at,
            unread: last ? last.sender_id !== user.id : false,
          };
        })
      );

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
    const ch = supabase
      .channel("chats-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, loadChats)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, loadChats)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadChats]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Chats</Text>
        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/contacts");
          }}
          activeOpacity={0.85}
        >
          <Feather name="edit-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            Loading your chats…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={[styles.stateIcon, { backgroundColor: colors.muted }]}>
            <Feather name="alert-circle" size={28} color={colors.destructive} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>
            Something went wrong
          </Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            {error}
          </Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadChats}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.stateIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="message-circle" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>
            No conversations yet
          </Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            Head to People to start your first chat
          </Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/contacts")}
          >
            <Feather name="users" size={16} color="#fff" />
            <Text style={styles.retryText}>Browse People</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
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
                    },
                  });
                }}
                activeOpacity={0.7}
              >
                <Avatar uri={item.otherUser?.avatar_url} name={title} size={52} isOnline={online} />
                <View style={styles.chatInfo}>
                  <View style={styles.chatTopRow}>
                    <Text
                      style={[styles.chatName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>
                      {formatTime(item.lastMessageAt)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.chatPreview,
                      {
                        color: item.unread ? colors.foreground : colors.mutedForeground,
                        fontFamily: item.unread ? "Inter_500Medium" : "Inter_400Regular",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastMessage ?? "Tap to open conversation"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { setRefreshing(true); loadChats(); }}
          refreshing={refreshing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
  },
  newChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
  chatName: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chatPreview: { fontSize: 14, lineHeight: 18 },
});
