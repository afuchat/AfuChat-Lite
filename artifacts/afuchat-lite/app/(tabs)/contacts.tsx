import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Profile, getDisplayName, isOnline, supabase } from "@/lib/supabase";

export default function ContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchUsers = useCallback(
    async (q: string) => {
      if (!user) return;
      if (mounted.current) setLoading(true);
      try {
        let query = supabase
          .from("profiles")
          .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
          .neq("id", user.id)
          .limit(60);

        if (q.trim()) {
          query = query.or(
            `handle.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`
          );
        } else {
          query = query.order("created_at", { ascending: false });
        }

        const { data, error: qErr } = await query;
        if (qErr) throw qErr;
        if (mounted.current) { setUsers((data as Profile[]) ?? []); setError(null); }
      } catch (e: any) {
        if (mounted.current) setError(e?.message ?? "Failed to load people");
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => { fetchUsers(""); }, [fetchUsers]);
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(search), 350);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  const openChat = async (other: Profile) => {
    if (!user || starting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarting(other.id);
    try {
      // Find existing 1-on-1 chat
      const { data: mine } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      const myIds = (mine ?? []).map((r) => r.chat_id);

      if (myIds.length) {
        const { data: shared } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", other.id)
          .in("chat_id", myIds);

        if (shared?.length) {
          const { data: existing } = await supabase
            .from("chats")
            .select("id")
            .eq("id", shared[0].chat_id)
            .eq("is_group", false)
            .single();

          if (existing) {
            router.push({
              pathname: "/chat/[id]",
              params: { id: existing.id, name: getDisplayName(other), isGroup: "0", avatarUrl: other.avatar_url ?? "" },
            });
            return;
          }
        }
      }

      // Create new chat
      const { data: newChat, error: chatErr } = await supabase
        .from("chats")
        .insert({ is_group: false, created_by: user.id, user_id: other.id })
        .select()
        .single();

      if (chatErr) throw chatErr;
      if (!newChat) throw new Error("Chat creation returned empty");

      const { error: memberErr } = await supabase.from("chat_members").insert([
        { chat_id: newChat.id, user_id: user.id },
        { chat_id: newChat.id, user_id: other.id },
      ]);
      if (memberErr) throw memberErr;

      router.push({
        pathname: "/chat/[id]",
        params: { id: newChat.id, name: getDisplayName(other), isGroup: "0", avatarUrl: other.avatar_url ?? "" },
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not open chat. Please try again.");
    } finally {
      if (mounted.current) setStarting(null);
    }
  };

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
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>People</Text>
        <Text style={[styles.userCount, { color: colors.mutedForeground }]}>
          {users.length > 0 ? `${users.length} users` : ""}
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by name or @handle…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={10}>
            <Feather name="x-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            Finding people…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={[styles.stateIcon, { backgroundColor: colors.muted }]}>
            <Feather name="alert-circle" size={28} color={colors.destructive} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>
            Failed to load
          </Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => fetchUsers(search)}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.stateIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="user-x" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>
            {search ? "No results" : "No users yet"}
          </Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            {search
              ? `Nobody found for "${search}"`
              : "Be the first to invite someone!"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => {
            const name = getDisplayName(item);
            const online = isOnline(item);
            const busy = starting === item.id;

            return (
              <TouchableOpacity
                style={[styles.userRow, { borderBottomColor: colors.border }]}
                onPress={() => openChat(item)}
                disabled={!!starting}
                activeOpacity={0.7}
              >
                <Avatar uri={item.avatar_url} name={name} size={50} isOnline={online} />
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text
                      style={[styles.userName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {item.is_verified && (
                      <Feather name="check-circle" size={14} color={colors.primary} />
                    )}
                  </View>
                  <Text
                    style={[styles.userHandle, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    @{item.handle}
                  </Text>
                  {item.bio ? (
                    <Text
                      style={[styles.userBio, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {item.bio}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.chatBtnWrap}>
                  {busy ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <View style={[styles.chatBtn, { backgroundColor: colors.secondary }]}>
                      <Feather name="message-circle" size={18} color={colors.primary} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  userCount: { fontSize: 14, fontFamily: "Inter_400Regular", paddingBottom: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  stateIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  stateText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  userName: { fontSize: 16, fontFamily: "Inter_500Medium", flexShrink: 1 },
  userHandle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  userBio: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chatBtnWrap: { width: 44, alignItems: "center" },
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
