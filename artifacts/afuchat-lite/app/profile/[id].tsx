import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Post, Profile, getDisplayName, isOnline, supabase } from "@/lib/supabase";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function MiniPostCard({
  post,
  colors,
}: {
  post: Post;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[postCard.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[postCard.content, { color: colors.foreground }]}>{post.content}</Text>
      <View style={postCard.footer}>
        <View style={postCard.stat}>
          <Feather name="heart" size={13} color={colors.mutedForeground} />
          <Text style={[postCard.statText, { color: colors.mutedForeground }]}>
            {post.like_count ?? 0}
          </Text>
        </View>
        <View style={postCard.stat}>
          <Feather name="message-square" size={13} color={colors.mutedForeground} />
          <Text style={[postCard.statText, { color: colors.mutedForeground }]}>
            {post.comment_count ?? 0}
          </Text>
        </View>
        <Text style={[postCard.time, { color: colors.mutedForeground }]}>
          {timeAgo(post.created_at)}
        </Text>
      </View>
    </View>
  );
}

const postCard = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  content: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  footer: { flexDirection: "row", alignItems: "center", gap: 14 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: "auto" },
});

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadPosts = useCallback(async (userId: string) => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const { data } = await supabase
        .from("posts")
        .select("id, author_id, content, image_url, like_count, comment_count, created_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (mounted.current) setPosts((data ?? []) as Post[]);
    } catch {
      // silently ignore
    } finally {
      if (mounted.current) setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("profiles")
      .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (mounted.current) {
          setProfile((data as Profile) ?? null);
          setLoading(false);
          if (data) loadPosts(data.id);
        }
      });
  }, [id, loadPosts]);

  const openChat = async () => {
    if (!user || !profile || starting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarting(true);
    try {
      const { data: mine } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      const myIds = (mine ?? []).map((r) => r.chat_id);

      if (myIds.length) {
        const { data: shared } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", profile.id)
          .in("chat_id", myIds);

        if (shared?.length) {
          const { data: existing } = await supabase
            .from("chats")
            .select("id")
            .eq("id", shared[0].chat_id)
            .eq("is_group", false)
            .single();

          if (existing) {
            router.replace({
              pathname: "/chat/[id]",
              params: { id: existing.id, name: getDisplayName(profile), isGroup: "0", avatarUrl: profile.avatar_url ?? "", otherId: profile.id, isVerified: profile.is_verified ? "1" : "0" },
            });
            return;
          }
        }
      }

      const { data: newChat, error: chatErr } = await supabase
        .from("chats")
        .insert({ is_group: false, created_by: user.id, user_id: profile.id })
        .select()
        .single();

      if (chatErr) throw chatErr;

      await supabase.from("chat_members").insert([
        { chat_id: newChat.id, user_id: user.id },
        { chat_id: newChat.id, user_id: profile.id },
      ]);

      router.replace({
        pathname: "/chat/[id]",
        params: { id: newChat.id, name: getDisplayName(profile), isGroup: "0", avatarUrl: profile.avatar_url ?? "", otherId: profile.id, isVerified: profile.is_verified ? "1" : "0" },
      });
    } catch {
      // navigation failed silently — user can retry
    } finally {
      if (mounted.current) setStarting(false);
    }
  };

  const headerComponent = profile ? (
    <>
      {/* Avatar + name section */}
      <View style={[styles.hero, { backgroundColor: colors.primary + "18" }]}>
        <Avatar uri={profile.avatar_url} name={getDisplayName(profile)} size={96} isOnline={isOnline(profile)} />
        <View style={styles.heroInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
              {getDisplayName(profile)}
            </Text>
            {profile.is_verified && <VerifiedBadge size={20} />}
          </View>
          <Text style={[styles.handle, { color: colors.primary }]}>@{profile.handle}</Text>
          <Text style={[styles.onlineStatus, { color: isOnline(profile) ? "#22C55E" : colors.mutedForeground }]}>
            {isOnline(profile) ? "● Online" : "● Offline"}
          </Text>
        </View>
      </View>

      {/* Bio */}
      {profile.bio ? (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BIO</Text>
          <Text style={[styles.bioText, { color: colors.foreground }]}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* Stats */}
      <View style={[styles.statsRow, { borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{profile.acoin ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ACoins</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Joined</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{posts.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Posts</Text>
        </View>
      </View>

      {/* Message button — only if not own profile */}
      {user?.id !== profile.id && (
        <Pressable
          style={[styles.messageBtn, { backgroundColor: colors.primary }]}
          onPress={openChat}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="message-circle" size={18} color="#fff" />
              <Text style={styles.messageBtnText}>Message</Text>
            </>
          )}
        </Pressable>
      )}

      {/* Posts heading */}
      <View style={styles.postsHeader}>
        <Text style={[styles.postsTitle, { color: colors.foreground }]}>Posts</Text>
        {postsLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
    </>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Back bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !profile ? (
        <View style={styles.centered}>
          <Feather name="user-x" size={36} color={colors.mutedForeground} />
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>User not found</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={headerComponent}
          renderItem={({ item }) => (
            <View style={styles.postWrap}>
              <MiniPostCard post={item} colors={colors} />
            </View>
          )}
          ListEmptyComponent={
            !postsLoading ? (
              <View style={styles.emptyPosts}>
                <Feather name="feather" size={22} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No posts yet</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 14,
    marginHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  heroInfo: { alignItems: "center", gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  displayName: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  handle: { fontSize: 15, fontFamily: "Inter_500Medium" },
  onlineStatus: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  bioText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  stat: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statDivider: { width: 1 },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 15,
    borderRadius: 16,
  },
  messageBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  postsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  postsTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  postWrap: { paddingHorizontal: 16, marginBottom: 10 },
  emptyPosts: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 24,
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
