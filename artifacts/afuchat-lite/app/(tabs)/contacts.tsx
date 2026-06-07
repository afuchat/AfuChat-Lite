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

  const fetchUsers = useCallback(async (q: string) => {
    if (!user) return;
    if (mounted.current) setLoading(true);
    try {
      let query = supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
        .neq("id", user.id)
        .limit(50);

      if (q.trim()) {
        query = query.or(`handle.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      if (mounted.current) { setUsers((data as Profile[]) ?? []); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load users");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => { fetchUsers(""); }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(search), 350);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  /** Open existing or create a new 1-on-1 chat with otherUser. */
  const openChat = async (otherUser: Profile) => {
    if (!user || starting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarting(otherUser.id);

    try {
      // Find existing 1-on-1 chat
      const { data: myMemberships } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      const myIds = (myMemberships ?? []).map((r) => r.chat_id);

      if (myIds.length > 0) {
        const { data: shared } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", otherUser.id)
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
              params: { id: existing.id, name: getDisplayName(otherUser), isGroup: "0" },
            });
            return;
          }
        }
      }

      // Create new 1-on-1 chat
      const { data: newChat, error: chatErr } = await supabase
        .from("chats")
        .insert({ is_group: false, created_by: user.id, user_id: otherUser.id })
        .select()
        .single();

      if (chatErr) throw chatErr;
      if (!newChat) throw new Error("Chat creation returned empty");

      // Add both members
      const { error: memberErr } = await supabase.from("chat_members").insert([
        { chat_id: newChat.id, user_id: user.id },
        { chat_id: newChat.id, user_id: otherUser.id },
      ]);

      if (memberErr) throw memberErr;

      router.push({
        pathname: "/chat/[id]",
        params: { id: newChat.id, name: getDisplayName(otherUser), isGroup: "0" },
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not open chat. Please try again.");
    } finally {
      if (mounted.current) setStarting(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>People</Text>
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.muted, marginHorizontal: 16, marginVertical: 10 }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search name or @handle…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={10}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Loading people…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.hint, { color: colors.destructive }]}>{error}</Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchUsers(search)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Feather name="user-x" size={40} color={colors.mutedForeground} />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {search ? "No users match your search" : "No other users yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => {
            const online = isOnline(item);
            const name = getDisplayName(item);
            const busy = starting === item.id;
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => openChat(item)}
                disabled={!!starting}
                activeOpacity={0.7}
              >
                <Avatar name={name} size={50} isOnline={online} />
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {item.is_verified && (
                      <Feather name="check-circle" size={14} color={colors.primary} />
                    )}
                  </View>
                  <Text style={[styles.handle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    @{item.handle}
                  </Text>
                  {item.bio ? (
                    <Text style={[styles.bio, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.bio}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.action}>
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  hint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { fontSize: 16, fontFamily: "Inter_500Medium" },
  handle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  bio: { fontSize: 12, fontFamily: "Inter_400Regular" },
  action: { width: 42, alignItems: "center" },
  chatBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
