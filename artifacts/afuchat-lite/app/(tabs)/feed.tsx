import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Post, PostReply, Profile, getDisplayName, supabase } from "@/lib/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MAX_CHARS = 500;

// ── Comment item ──────────────────────────────────────────────────────────────

type CommentItemProps = {
  reply: PostReply;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  currentUserId: string;
  onReply: (handle: string) => void;
};

function CommentItem({ reply, colors, currentUserId, onReply }: CommentItemProps) {
  const router = useRouter();
  const name = getDisplayName(reply.author ?? null);
  const isOwn = reply.author_id === currentUserId;
  const [liked, setLiked] = useState(false);
  const heartAnim = useRef(new Animated.Value(1)).current;

  const toggleLike = () => {
    setLiked((v) => !v);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.4, useNativeDriver: true, speed: 120, bounciness: 8 }),
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 4 }),
    ]).start();
  };

  return (
    <View style={ci.row}>
      <Pressable onPress={() => router.push({ pathname: "/profile/[id]", params: { id: reply.author_id } })}>
        <Avatar uri={reply.author?.avatar_url} name={name} size={32} />
      </Pressable>
      <View style={ci.body}>
        <View style={ci.meta}>
          <Pressable onPress={() => router.push({ pathname: "/profile/[id]", params: { id: reply.author_id } })}>
            <Text style={[ci.name, { color: colors.foreground }]} numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
          {reply.author?.is_verified && <VerifiedBadge size={13} />}
          <Text style={[ci.time, { color: colors.mutedForeground }]}>· {timeAgo(reply.created_at)}</Text>
          {isOwn && (
            <View style={[ci.ownBadge, { backgroundColor: colors.primary + "18" }]}>
              <Text style={[ci.ownText, { color: colors.primary }]}>you</Text>
            </View>
          )}
        </View>
        <Text style={[ci.content, { color: colors.foreground }]}>{reply.content}</Text>
        <View style={ci.actions}>
          <Pressable style={ci.action} onPress={toggleLike}>
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Feather name="heart" size={13} color={liked ? "#EF4444" : colors.mutedForeground} />
            </Animated.View>
          </Pressable>
          <Pressable style={ci.action} onPress={() => onReply(reply.author?.handle ?? name)}>
            <Feather name="corner-up-left" size={13} color={colors.mutedForeground} />
            <Text style={[ci.actionText, { color: colors.mutedForeground }]}>Reply</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const ci = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, paddingVertical: 10 },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "nowrap" },
  name: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ownBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  ownText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  content: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  actions: { flexDirection: "row", gap: 16, marginTop: 4 },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

// ── Comments section ──────────────────────────────────────────────────────────

type CommentsSectionProps = {
  postId: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  currentUserId: string;
  onCountChange: (delta: number) => void;
  profile: Profile | null;
};

function CommentsSection({ postId, colors, currentUserId, onCountChange, profile }: CommentsSectionProps) {
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const mounted = useRef(true);
  const PAGE_SIZE = 8;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async (p = 1) => {
    try {
      const { data, error } = await supabase
        .from("post_replies")
        .select("id, post_id, author_id, content, created_at, parent_reply_id")
        .eq("post_id", postId)
        .is("parent_reply_id", null)
        .order("created_at", { ascending: true })
        .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE);

      if (error) throw error;
      const list = (data ?? []) as PostReply[];
      const trimmed = list.slice(0, PAGE_SIZE);
      const ids = [...new Set(trimmed.map((r) => r.author_id))];
      let withProfiles = trimmed;
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, handle, avatar_url, is_verified")
          .in("id", ids);
        const pm = new Map((profiles ?? []).map((pr: any) => [pr.id, pr as Profile]));
        withProfiles = trimmed.map((r) => ({ ...r, author: pm.get(r.author_id) }));
      }
      if (mounted.current) {
        setReplies((prev) => p === 1 ? withProfiles : [...prev, ...withProfiles]);
        setHasMore(list.length > PAGE_SIZE);
        setPage(p);
        setLoading(false);
      }
    } catch {
      if (mounted.current) setLoading(false);
    }
  }, [postId]);

  useEffect(() => { load(1); }, [load]);

  const handleSetReply = (handle: string) => {
    setReplyTo(handle);
    setText(`@${handle} `);
    inputRef.current?.focus();
    Haptics.selectionAsync();
  };

  const submit = async () => {
    const content = text.trim();
    if (!content || !currentUserId) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { error } = await supabase
        .from("post_replies")
        .insert({ post_id: postId, author_id: currentUserId, content });
      if (error) throw error;
      setText("");
      setReplyTo(null);
      onCountChange(1);
      load(1);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not post comment");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const authorName = getDisplayName(profile);

  return (
    <View style={cs.wrap}>
      {loading ? (
        <View style={cs.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : replies.length === 0 ? (
        <Text style={[cs.empty, { color: colors.mutedForeground }]}>No comments yet</Text>
      ) : (
        <>
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              reply={r}
              colors={colors}
              currentUserId={currentUserId}
              onReply={handleSetReply}
            />
          ))}
          {hasMore && (
            <Pressable onPress={() => load(page + 1)} style={cs.loadMore}>
              <Text style={[cs.loadMoreText, { color: colors.primary }]}>Load more comments</Text>
            </Pressable>
          )}
        </>
      )}

      {/* Comment input */}
      <View style={[cs.inputRow, { borderTopColor: colors.border }]}>
        <Avatar uri={profile?.avatar_url} name={authorName} size={30} />
        <View style={[cs.inputWrap, { backgroundColor: colors.muted, borderColor: replyTo ? colors.primary : "transparent" }]}>
          {replyTo && (
            <View style={cs.replyChip}>
              <Text style={[cs.replyChipText, { color: colors.primary }]}>↩ @{replyTo}</Text>
              <Pressable onPress={() => { setReplyTo(null); setText(""); }} hitSlop={6}>
                <Feather name="x" size={11} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
          <TextInput
            ref={inputRef}
            style={[cs.input, { color: colors.foreground }]}
            placeholder="Add a comment…"
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_CHARS}
          />
        </View>
        <Pressable
          style={[cs.send, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
          onPress={submit}
          disabled={!text.trim() || submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="send" size={14} color={text.trim() ? "#fff" : colors.mutedForeground} />
          }
        </Pressable>
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  wrap: { gap: 0 },
  loading: { paddingVertical: 14, alignItems: "center" },
  empty: { fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 12, textAlign: "center" },
  loadMore: { paddingVertical: 10, alignItems: "center" },
  loadMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 4,
  },
  replyChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  input: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 72,
    lineHeight: 19,
    paddingTop: 0,
    paddingBottom: 0,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── Post row ──────────────────────────────────────────────────────────────────

type PostRowProps = {
  post: Post;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  currentUserId: string;
  currentProfile: Profile | null;
  onLike: (id: string, nowLiked: boolean) => void;
  onDelete: (id: string) => void;
  onCountChange: (id: string, delta: number) => void;
};

function PostRow({ post, colors, currentUserId, currentProfile, onLike, onDelete, onCountChange }: PostRowProps) {
  const router = useRouter();
  const isOwn = post.author_id === currentUserId;
  const authorName = getDisplayName(post.author ?? null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const heartAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(post.liked_by_me ? 1 : 0)).current;

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike(post.id, !post.liked_by_me);
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.35, useNativeDriver: true, speed: 120, bounciness: 8 }),
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 4 }),
    ]).start();
  };

  const toggleComments = () => {
    setCommentsOpen((v) => !v);
    Haptics.selectionAsync();
  };

  const confirmDelete = () => {
    Alert.alert("Delete post", "Remove this post forever?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(post.id) },
    ]);
  };

  return (
    <View style={[pr.wrap, { borderBottomColor: colors.border }]}>
      {/* Left: avatar thread line */}
      <View style={pr.left}>
        <Pressable onPress={() => router.push({ pathname: "/profile/[id]", params: { id: post.author_id } })}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size={42} />
        </Pressable>
        {commentsOpen && <View style={[pr.threadLine, { backgroundColor: colors.border }]} />}
      </View>

      {/* Right: content */}
      <View style={pr.right}>
        {/* Meta row */}
        <View style={pr.metaRow}>
          <Pressable
            style={pr.authorPress}
            onPress={() => router.push({ pathname: "/profile/[id]", params: { id: post.author_id } })}
          >
            <Text style={[pr.name, { color: colors.foreground }]} numberOfLines={1}>
              {authorName}
            </Text>
            {post.author?.is_verified && <VerifiedBadge size={15} />}
            <Text style={[pr.handle, { color: colors.mutedForeground }]} numberOfLines={1}>
              @{post.author?.handle}
            </Text>
          </Pressable>
          <Text style={[pr.time, { color: colors.mutedForeground }]}>· {timeAgo(post.created_at)}</Text>
          {isOwn && (
            <Pressable onPress={confirmDelete} hitSlop={10} style={pr.deleteBtn}>
              <Feather name="more-horizontal" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <Text style={[pr.content, { color: colors.foreground }]}>{post.content}</Text>

        {/* Actions */}
        <View style={pr.actions}>
          {/* Comments */}
          <Pressable style={pr.action} onPress={toggleComments}>
            <Feather
              name="message-circle"
              size={18}
              color={commentsOpen ? colors.primary : colors.mutedForeground}
            />
            {(post.comment_count ?? 0) > 0 && (
              <Text style={[pr.actionCount, { color: commentsOpen ? colors.primary : colors.mutedForeground }]}>
                {post.comment_count}
              </Text>
            )}
          </Pressable>

          {/* Like */}
          <Pressable style={pr.action} onPress={handleLike}>
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Feather
                name={post.liked_by_me ? "heart" : "heart"}
                size={18}
                color={post.liked_by_me ? "#EF4444" : colors.mutedForeground}
              />
            </Animated.View>
            {(post.like_count ?? 0) > 0 && (
              <Animated.Text style={[pr.actionCount, { color: post.liked_by_me ? "#EF4444" : colors.mutedForeground }]}>
                {post.like_count}
              </Animated.Text>
            )}
          </Pressable>

          {/* Share placeholder */}
          <Pressable style={pr.action} onPress={() => Haptics.selectionAsync()}>
            <Feather name="share" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Comments section */}
        {commentsOpen && (
          <CommentsSection
            postId={post.id}
            colors={colors}
            currentUserId={currentUserId}
            onCountChange={(d) => onCountChange(post.id, d)}
            profile={currentProfile}
          />
        )}
      </View>
    </View>
  );
}

const pr = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { alignItems: "center", gap: 0 },
  threadLine: { width: 2, flex: 1, borderRadius: 1, marginTop: 6, marginBottom: -4 },
  right: { flex: 1, gap: 4, paddingBottom: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "nowrap" },
  authorPress: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  name: { fontSize: 15, fontFamily: "Inter_700Bold", flexShrink: 1 },
  handle: { fontSize: 13, fontFamily: "Inter_400Regular", flexShrink: 1 },
  time: { fontSize: 13, fontFamily: "Inter_400Regular", flexShrink: 0 },
  deleteBtn: { marginLeft: "auto" },
  content: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    marginTop: 10,
    marginBottom: 2,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

// ── Compose modal ─────────────────────────────────────────────────────────────

type ComposeModalProps = {
  visible: boolean;
  onClose: () => void;
  onPost: (content: string) => Promise<void>;
  profile: Profile | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  insets: { top: number; bottom: number };
};

function ComposeModal({ visible, onClose, onPost, profile, colors, insets }: ComposeModalProps) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const remaining = MAX_CHARS - text.length;
  const canPost = text.trim().length > 0 && !posting;
  const authorName = getDisplayName(profile);

  const handlePost = async () => {
    if (!canPost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPosting(true);
    try {
      await onPost(text.trim());
      setText("");
      onClose();
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    if (text.trim()) {
      Alert.alert("Discard post?", "Your draft will be lost.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => { setText(""); onClose(); } },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[cm.screen, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[cm.header, { paddingTop: insets.top > 0 ? insets.top + 8 : 16, borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} style={cm.cancelBtn} hitSlop={10}>
            <Text style={[cm.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Text style={[cm.title, { color: colors.foreground }]}>New Post</Text>
          <Pressable
            style={[cm.postBtn, { backgroundColor: canPost ? colors.primary : colors.muted }]}
            onPress={handlePost}
            disabled={!canPost}
          >
            {posting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[cm.postBtnText, { color: canPost ? "#fff" : colors.mutedForeground }]}>Post</Text>
            }
          </Pressable>
        </View>

        {/* Compose area */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={cm.scrollBody}
          keyboardShouldPersistTaps="handled"
        >
          <View style={cm.composeRow}>
            <Avatar uri={profile?.avatar_url} name={authorName} size={44} />
            <View style={cm.inputArea}>
              <Text style={[cm.authorName, { color: colors.foreground }]}>{authorName}</Text>
              <TextInput
                ref={inputRef}
                style={[cm.input, { color: colors.foreground }]}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                maxLength={MAX_CHARS}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[cm.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <Pressable style={cm.mediaBtn} onPress={() => Haptics.selectionAsync()}>
            <Feather name="image" size={20} color={colors.primary} />
          </Pressable>
          <Pressable style={cm.mediaBtn} onPress={() => Haptics.selectionAsync()}>
            <Feather name="at-sign" size={20} color={colors.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text
            style={[
              cm.counter,
              {
                color:
                  remaining < 20
                    ? remaining < 0 ? "#EF4444" : "#FF9500"
                    : colors.mutedForeground,
              },
            ]}
          >
            {remaining}
          </Text>
          <View style={[cm.counterRing, { borderColor: remaining < 20 ? (remaining < 0 ? "#EF4444" : "#FF9500") : colors.border }]}>
            <View
              style={[
                cm.counterFill,
                {
                  width: `${Math.max(0, Math.min(100, ((MAX_CHARS - remaining) / MAX_CHARS) * 100))}%` as any,
                  backgroundColor: remaining < 20 ? (remaining < 0 ? "#EF4444" : "#FF9500") : colors.primary,
                },
              ]}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cm = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: { width: 64 },
  cancelText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  title: { flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 64, alignItems: "center" },
  postBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scrollBody: { padding: 16, paddingTop: 20 },
  composeRow: { flexDirection: "row", gap: 12 },
  inputArea: { flex: 1, gap: 4 },
  authorName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  input: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    lineHeight: 26,
    minHeight: 120,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mediaBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  counter: { fontSize: 14, fontFamily: "Inter_400Regular", marginRight: 8 },
  counterRing: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, overflow: "hidden", alignItems: "flex-start" },
  counterFill: { height: "100%" },
});

// ── Feed screen ───────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
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
        .limit(60);

      if (qErr) throw qErr;

      const postList = (data ?? []) as Post[];
      const authorIds = [...new Set(postList.map((p) => p.author_id).filter(Boolean))];

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
      .channel(`feed-rt-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, loadPosts)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, loadPosts)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, loadPosts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPosts]);

  const handlePost = async (content: string) => {
    if (!user) return;
    const { error: insertErr } = await supabase
      .from("posts")
      .insert({ author_id: user.id, content });
    if (insertErr) throw insertErr;
    await loadPosts();
  };

  const handleLike = async (postId: string, nowLiked: boolean) => {
    if (!user) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: nowLiked, like_count: Math.max(0, (p.like_count ?? 0) + (nowLiked ? 1 : -1)) }
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
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
        const post = posts.find((p) => p.id === postId);
        await supabase
          .from("posts")
          .update({ like_count: Math.max(0, (post?.like_count ?? 0) - 1) })
          .eq("id", postId);
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked_by_me: !nowLiked, like_count: Math.max(0, (p.like_count ?? 0) + (nowLiked ? -1 : 1)) }
            : p
        )
      );
    }
  };

  const handleDelete = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await supabase.from("posts").delete().eq("id", postId);
  };

  const handleCountChange = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) + delta) } : p
      )
    );
  };

  const headerComp = useMemo(
    () => (
      <View style={[fs.listHeader, { borderBottomColor: colors.border }]}>
        <Avatar uri={profile?.avatar_url} name={getDisplayName(profile)} size={32} />
        <Pressable
          style={[fs.draftTrigger, { borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setComposeOpen(true); }}
        >
          <Text style={[fs.draftText, { color: colors.mutedForeground }]}>What's on your mind?</Text>
        </Pressable>
        <Pressable
          style={[fs.postFastBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setComposeOpen(true); }}
        >
          <Text style={fs.postFastText}>Post</Text>
        </Pressable>
      </View>
    ),
    [profile, colors]
  );

  return (
    <View style={[fs.screen, { backgroundColor: colors.background }]}>
      {/* Fixed top bar */}
      <View style={[fs.topBar, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Text style={[fs.topTitle, { color: colors.foreground }]}>Feed</Text>
        <Pressable
          style={fs.composeIcon}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setComposeOpen(true); }}
          hitSlop={10}
        >
          <Feather name="edit-3" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {loading ? (
        <View style={fs.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={fs.centered}>
          <Feather name="alert-circle" size={28} color="#EF4444" />
          <Text style={[fs.stateTitle, { color: colors.foreground }]}>Could not load feed</Text>
          <Text style={[fs.stateSub, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable style={[fs.retryBtn, { backgroundColor: colors.primary }]} onPress={loadPosts}>
            <Text style={fs.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={headerComp}
          renderItem={({ item }) => (
            <PostRow
              post={item}
              colors={colors}
              currentUserId={user?.id ?? ""}
              currentProfile={profile}
              onLike={handleLike}
              onDelete={handleDelete}
              onCountChange={handleCountChange}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { setRefreshing(true); loadPosts(); }}
          refreshing={refreshing}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={fs.emptyWrap}>
              <View style={[fs.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="feather" size={30} color={colors.primary} />
              </View>
              <Text style={[fs.stateTitle, { color: colors.foreground }]}>Nothing here yet</Text>
              <Text style={[fs.stateSub, { color: colors.mutedForeground }]}>
                Be the first to post something
              </Text>
              <Pressable
                style={[fs.startPostBtn, { backgroundColor: colors.primary }]}
                onPress={() => setComposeOpen(true)}
              >
                <Feather name="edit-3" size={15} color="#fff" />
                <Text style={fs.startPostText}>Create a post</Text>
              </Pressable>
            </View>
          }
        />
      )}

      <ComposeModal
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPost={handlePost}
        profile={profile}
        colors={colors}
        insets={{ top: insets.top, bottom: insets.bottom }}
      />
    </View>
  );
}

const fs = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  composeIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  draftTrigger: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  draftText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  postFastBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  postFastText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyWrap: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  stateTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  stateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  retryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  startPostBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 6 },
  startPostText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
