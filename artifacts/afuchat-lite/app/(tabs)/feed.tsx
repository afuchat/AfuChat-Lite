import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Post, PostReply, Profile, getDisplayName, supabase } from "@/lib/supabase";

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

// ── Comment row ───────────────────────────────────────────────────────────────
function CommentRow({ reply, colors }: { reply: PostReply; colors: any }) {
  const router = useRouter();
  const name = getDisplayName(reply.author ?? null);
  return (
    <View style={commentStyles.row}>
      <Pressable onPress={() => router.push({ pathname: "/profile/[id]", params: { id: reply.author_id } })}>
        <Avatar uri={reply.author?.avatar_url} name={name} size={30} />
      </Pressable>
      <View style={[commentStyles.bubble, { backgroundColor: colors.muted }]}>
        <View style={commentStyles.nameRow}>
          <Text style={[commentStyles.name, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>
          {reply.author?.is_verified && <VerifiedBadge size={14} />}
          <Text style={[commentStyles.time, { color: colors.mutedForeground }]}>
            · {timeAgo(reply.created_at)}
          </Text>
        </View>
        <Text style={[commentStyles.content, { color: colors.foreground }]}>{reply.content}</Text>
      </View>
    </View>
  );
}

const commentStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 10 },
  bubble: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "nowrap" },
  name: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular" },
  content: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 19 },
});

// ── Post card ─────────────────────────────────────────────────────────────────
function PostCard({
  post,
  colors,
  currentUserId,
  onLikeToggle,
  onDelete,
  onCommentCountChange,
}: {
  post: Post;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  currentUserId: string;
  onLikeToggle: (id: string, liked: boolean) => void;
  onDelete: (id: string) => void;
  onCommentCountChange: (id: string, delta: number) => void;
}) {
  const router = useRouter();
  const isOwn = post.author_id === currentUserId;
  const authorName = getDisplayName(post.author ?? null);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadReplies = useCallback(async () => {
    if (!post.id) return;
    setRepliesLoading(true);
    try {
      const { data, error } = await supabase
        .from("post_replies")
        .select("id, post_id, author_id, content, created_at, parent_reply_id")
        .eq("post_id", post.id)
        .is("parent_reply_id", null)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      const list = (data ?? []) as PostReply[];
      const ids = [...new Set(list.map((r) => r.author_id))];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, handle, avatar_url, is_verified")
          .in("id", ids);
        const pm = new Map((profiles ?? []).map((p: any) => [p.id, p as Profile]));
        if (mounted.current) setReplies(list.map((r) => ({ ...r, author: pm.get(r.author_id) })));
      } else {
        if (mounted.current) setReplies([]);
      }
    } catch {
      // silently ignore — section will be empty
    } finally {
      if (mounted.current) setRepliesLoading(false);
    }
  }, [post.id]);

  const toggleComments = () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening) loadReplies();
  };

  const submitComment = async () => {
    const content = commentText.trim();
    if (!content || !currentUserId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("post_replies")
        .insert({ post_id: post.id, author_id: currentUserId, content });
      if (error) throw error;
      setCommentText("");
      onCommentCountChange(post.id, 1);
      loadReplies();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not post comment");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const likeCount = post.like_count ?? 0;
  const commentCount = post.comment_count ?? 0;

  return (
    <View style={[postStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* ── Header ─────────────────────────────────── */}
      <View style={postStyles.header}>
        <Pressable
          style={postStyles.authorRow}
          onPress={() => router.push({ pathname: "/profile/[id]", params: { id: post.author_id } })}
        >
          <Avatar uri={post.author?.avatar_url} name={authorName} size={40} />
          <View style={postStyles.authorInfo}>
            <View style={postStyles.nameRow}>
              <Text style={[postStyles.authorName, { color: colors.foreground }]} numberOfLines={1}>
                {authorName}
              </Text>
              {post.author?.is_verified && <VerifiedBadge size={16} />}
            </View>
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

      {/* ── Content ────────────────────────────────── */}
      <Text style={[postStyles.content, { color: colors.foreground }]}>{post.content}</Text>

      {/* ── Actions ────────────────────────────────── */}
      <View style={[postStyles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={postStyles.action}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLikeToggle(post.id, !post.liked_by_me);
          }}
        >
          <Feather
            name="heart"
            size={16}
            color={post.liked_by_me ? "#EF4444" : colors.mutedForeground}
          />
          <Text
            style={[
              postStyles.actionText,
              { color: post.liked_by_me ? "#EF4444" : colors.mutedForeground },
            ]}
          >
            {likeCount > 0 ? likeCount : ""} {likeCount === 1 ? "Like" : "Likes"}
          </Text>
        </Pressable>

        <Pressable style={postStyles.action} onPress={toggleComments}>
          <Feather
            name="message-square"
            size={16}
            color={commentsOpen ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              postStyles.actionText,
              { color: commentsOpen ? colors.primary : colors.mutedForeground },
            ]}
          >
            {commentCount > 0 ? commentCount : ""} Comment{commentCount !== 1 ? "s" : ""}
          </Text>
        </Pressable>
      </View>

      {/* ── Comments section ───────────────────────── */}
      {commentsOpen && (
        <View style={[postStyles.commentsWrap, { borderTopColor: colors.border }]}>
          {repliesLoading ? (
            <View style={postStyles.commentsLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : replies.length === 0 ? (
            <Text style={[postStyles.noComments, { color: colors.mutedForeground }]}>
              No comments yet. Be the first!
            </Text>
          ) : (
            replies.map((r) => <CommentRow key={r.id} reply={r} colors={colors} />)
          )}

          {/* Comment input */}
          <View style={[postStyles.commentInput, { borderTopColor: colors.border }]}>
            <TextInput
              style={[postStyles.commentField, { backgroundColor: colors.muted, color: colors.foreground }]}
              placeholder="Add a comment…"
              placeholderTextColor={colors.mutedForeground}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <Pressable
              style={[
                postStyles.sendComment,
                { backgroundColor: commentText.trim() ? colors.primary : colors.muted },
              ]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={15} color={commentText.trim() ? "#fff" : colors.mutedForeground} />
              )}
            </Pressable>
          </View>
        </View>
      )}
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
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  postTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  content: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
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
  commentsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 0,
  },
  commentsLoading: { alignItems: "center", paddingVertical: 16 },
  noComments: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 12,
  },
  commentInput: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 6,
    marginTop: 4,
  },
  commentField: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 80,
    lineHeight: 19,
  },
  sendComment: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── Feed screen ───────────────────────────────────────────────────────────────
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
        .select("id, author_id, content, image_url, like_count, comment_count, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (qErr) throw qErr;

      const postList = (data ?? []) as Post[];
      const authorIds = [...new Set(postList.map((p) => p.author_id).filter(Boolean))];

      // Fetch author profiles + my liked post IDs in parallel
      const [profilesResult, likedResult] = await Promise.all([
        authorIds.length
          ? supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url, is_verified")
              .in("id", authorIds)
          : Promise.resolve({ data: [] as Profile[] }),
        user
          ? supabase
              .from("post_likes")
              .select("post_id")
              .eq("user_id", user.id)
              .in("post_id", postList.map((p) => p.id))
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);

      const profileMap = new Map(
        ((profilesResult as any).data ?? []).map((p: Profile) => [p.id, p])
      );
      const likedSet = new Set(
        ((likedResult as any).data ?? []).map((l: { post_id: string }) => l.post_id)
      );

      const enriched = postList.map((p) => ({
        ...p,
        like_count: p.like_count ?? 0,
        comment_count: p.comment_count ?? 0,
        author: profileMap.get(p.author_id) as Profile | undefined,
        liked_by_me: likedSet.has(p.id),
      }));

      if (mounted.current) { setPosts(enriched); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load feed");
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, [user]);

  useEffect(() => {
    loadPosts();
    const ch = supabase
      .channel("feed-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, loadPosts)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, loadPosts)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, loadPosts)
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
        .insert({ author_id: user.id, content });
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

  const handleLikeToggle = async (postId: string, nowLiked: boolean) => {
    if (!user) return;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: nowLiked,
              like_count: Math.max(0, (p.like_count ?? 0) + (nowLiked ? 1 : -1)),
            }
          : p
      )
    );
    try {
      if (nowLiked) {
        await supabase.from("post_likes").upsert(
          { post_id: postId, user_id: user.id },
          { onConflict: "post_id,user_id", ignoreDuplicates: true }
        );
        const post = posts.find((p) => p.id === postId);
        await supabase
          .from("posts")
          .update({ like_count: Math.max(0, (post?.like_count ?? 0) + 1) })
          .eq("id", postId);
      } else {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        const post = posts.find((p) => p.id === postId);
        await supabase
          .from("posts")
          .update({ like_count: Math.max(0, (post?.like_count ?? 0) - 1) })
          .eq("id", postId);
      }
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: !nowLiked,
                like_count: Math.max(0, (p.like_count ?? 0) + (nowLiked ? -1 : 1)),
              }
            : p
        )
      );
    }
  };

  const handleDelete = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await supabase.from("posts").delete().eq("id", postId);
  };

  const handleCommentCountChange = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) + delta) } : p
      )
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Feed</Text>
      </View>

      {/* Compose box */}
      {composing && (
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
      )}

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
              onLikeToggle={handleLikeToggle}
              onDelete={handleDelete}
              onCommentCountChange={handleCommentCountChange}
            />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { setRefreshing(true); loadPosts(); }}
          refreshing={refreshing}
          keyboardShouldPersistTaps="handled"
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
    </KeyboardAvoidingView>
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
