import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

import { Avatar, isRecentlyOnline } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Profile, getDisplayName, supabase } from "@/lib/supabase";

export default function ContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (q: string) => {
      if (!user) return;
      setLoading(true);
      try {
        let query = supabase
          .from("profiles")
          .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
          .neq("id", user.id)
          .limit(40);

        if (q.trim()) {
          query = query.or(
            `handle.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`
          );
        } else {
          query = query.order("created_at", { ascending: false });
        }

        const { data } = await query;
        setUsers((data as Profile[]) ?? []);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => { fetchUsers(""); }, [fetchUsers]);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  const startChat = async (otherUser: Profile) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarting(otherUser.id);

    try {
      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      const myIds = (myConvs ?? []).map((r) => r.conversation_id);

      if (myIds.length > 0) {
        const { data: sharedConvs } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", otherUser.id)
          .in("conversation_id", myIds);

        if (sharedConvs?.length) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", sharedConvs[0].conversation_id)
            .eq("is_group", false)
            .single();

          if (conv) {
            router.push({
              pathname: "/chat/[id]",
              params: { id: conv.id, name: getDisplayName(otherUser) },
            });
            return;
          }
        }
      }

      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ is_group: false, created_by: user.id })
        .select()
        .single();

      if (error || !conv) {
        Alert.alert("Error", "Could not start chat. Please try again.");
        return;
      }

      await supabase.from("conversation_participants").insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: otherUser.id },
      ]);

      router.push({
        pathname: "/chat/[id]",
        params: { id: conv.id, name: getDisplayName(otherUser) },
      });
    } finally {
      setStarting(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.foreground }]}>People</Text>
      </View>

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.muted, marginHorizontal: 16, marginVertical: 10 },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by name or @handle..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Feather name="user-x" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search ? "No users found" : "No other users yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.userRow, { borderBottomColor: colors.border }]}
              onPress={() => startChat(item)}
              disabled={starting === item.id}
            >
              <Avatar
                name={getDisplayName(item)}
                size={48}
                isOnline={isRecentlyOnline(item.last_seen)}
              />
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.userName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {getDisplayName(item)}
                  </Text>
                  {item.is_verified && (
                    <Feather name="check-circle" size={14} color={colors.primary} />
                  )}
                </View>
                <Text
                  style={[styles.userHandle, { color: colors.mutedForeground }]}
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
              <View style={styles.action}>
                {starting === item.id ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <View style={[styles.chatBtn, { backgroundColor: colors.secondary }]}>
                    <Feather name="message-circle" size={18} color={colors.primary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  userName: { fontSize: 16, fontFamily: "Inter_500Medium" },
  userHandle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  userBio: { fontSize: 12, fontFamily: "Inter_400Regular" },
  action: { width: 40, alignItems: "center" },
  chatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
