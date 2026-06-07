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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Post, Profile, getDisplayName, supabase } from "@/lib/supabase";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function PostCard({ post, colors, currentUserId, onLike, onDelete }: {
  post: Post;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  currentUserId: string;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const isOwn = post.user_id === currentUserId;
  const authorName = getDisplayName(post.author ?? null);

  return (
    <View style={[postStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={postStyles.header}>
        <Pressable
          style={postStyles.authorRow}
          onPress={() => router.push({ pathname: "/profile/[id]", params: { id: post.user_id } })}
        >
          <Avatar uri={post.author?.avatar_url} name={authorName} size={38} />
          <View style={postStyles.authorInfo}>
            <Text style={[postStyles.authorName, { color: colors.foreground }]} numberOfLines={1}>
              {authorName}
            </Text>
            <Text style={[postStyles.postTime, { color: colors.mutedForeground }]}>
              {timeAgo(post.created_at)}
            </Text>
          </View>
        </Pressable>
        {isOwn && (
          <Pressable
            hitSlop={10}
            onPress={() =>
              Alert.alert("Delete post", "Remove this post?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => onDelete(post.id) },
              ])
            }
          >
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <Text style={[postStyles.content, { color: colors.foreground }]}>{post.content}</Text>

      <View style={[postStyles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={postStyles.action}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLike(post.id);
          }}
        >
          <Feather name="heart" size={16} color={colors.mutedForeground} />
          <Text style={[postStyles.actionText, { color: colors.mutedForeground }]}>
            {post.like_count > 0 ? post.like_count : ""} Like
          </Text>
        </Pressable>
        <Pressable style={postStyles.action}>
          <Feather name="message-square" size={16} color={colors.mutedForeground} />
          <Text style={[postStyles.actionText, { color: colors.mutedForeground }]}>
            {post.comment_count > 0 ? post.comment_count : ""} Comment
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const postStyles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    paddingBottom: 10,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  postTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  content: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, paddingHorizontal: 14, paddingBottom: 14 },
  footer: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  actionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const { data, error: qErr } = await supabase
        .from("posts")
        .select("id, user_id, content, image_url, like_count, comment_count, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (qErr) {
        if (qErr.message?.includes("does not exist")) {
          if (mounted.current) { setPosts([]); setError(null); }
          return;
        }
        throw qErr;
      }

      const postList = (data ?? []) as Post[];
      const authorIds = [...new Set(postList.map((p) => p.user_id))];
      const { data: profiles } = authorIds.length
        ? await supabase
            .from("profiles")
            .select("id, display_name, handle, avatar_url, is_verified")
            .in("id", authorIds)
        : { data: [] as Profile[] };

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p as Profile]));
      const enriched = postList.map((p) => ({ ...p, author: profileMap.get(p.user_id) }));

      if (mounted.current) { setPosts(enriched); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load feed");
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    loadPosts();
    const ch = supabase
      .channel("feed-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, loadPosts)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, loadPosts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPosts]);

  const submitPost = async () => {
    const content = draft.trim();
    if (!content || !user) return;
    setPosting(true);
    try {
      const { error: insertErr } = await supabase
        .from("posts")
        .insert({ user_id: user.id, content });
      if (insertErr) throw insertErr;
      setDraft("");
      setComposing(false);
      loadPosts();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not publish post.");
    } finally {
      if (mounted.current) setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, like_count: p.like_count + 1 } : p)
    );
    await supabase
      .from("posts")
      .update({ like_count: posts.find((p) => p.id === postId)!.like_count + 1 })
      .eq("id", postId);
  };

  const handleDelete = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await supabase.from("posts").delete().eq("id", postId);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <OfflineBanner />

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Feed</Text>
      </View>

      {/* Compose bar */}
      {composing ? (
        <View style={[styles.composeBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.composeInput, { color: colors.foreground }]}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.mutedForeground}
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            maxLength={500}
          />
          <View style={styles.composeActions}>
            <Pressable onPress={() => { setComposing(false); setDraft(""); }}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.postBtn, { backgroundColor: draft.trim() ? colors.primary : colors.muted }]}
              onPress={submitPost}
              disabled={!draft.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.postBtnText}>Post</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={28} color={colors.destructive} />
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>Could not load feed</Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadPosts}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              colors={colors}
              currentUserId={user?.id ?? ""}
              onLike={handleLike}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { setRefreshing(true); loadPosts(); }}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="feather" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>Nothing here yet</Text>
              <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                Be the first to post something
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {!composing && (
        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 86 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setComposing(true);
          }}
        >
          <Feather name="plus" size={22} color="#fff" />
        </Pressable>
      )}
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
  title: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  composeBox: {
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  composeInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 80,
    maxHeight: 160,
  },
  composeActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  postBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  postBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  stateText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
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
