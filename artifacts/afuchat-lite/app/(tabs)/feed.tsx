import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Post, PostReply, Profile, getDisplayName, supabase } from "@/lib/supabase";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const TAB_BAR_H = 90;
const ITEM_H = SCREEN_H;

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── side action button ────────────────────────────────────────────────────────

function SideAction({
  icon,
  label,
  onPress,
  active,
  activeColor,
}: {
  icon: string;
  label?: string | number;
  onPress: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pulse = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, speed: 200, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 80, bounciness: 4 }),
    ]).start();
  };

  return (
    <Pressable style={sa.wrap} onPress={() => { pulse(); onPress(); }} hitSlop={6}>
      <Animated.View style={[sa.icon, { transform: [{ scale }] }]}>
        <Feather
          name={icon as any}
          size={28}
          color={active ? (activeColor ?? "#EF4444") : "#fff"}
        />
      </Animated.View>
      {label !== undefined && label !== "" && (
        <Text style={sa.label}>{typeof label === "number" ? fmtCount(label) : label}</Text>
      )}
    </Pressable>
  );
}

const sa = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  label: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

// ── comments sheet ────────────────────────────────────────────────────────────

type CommentSheetProps = {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onCountChange: (delta: number) => void;
  currentUserId: string;
  profile: Profile | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
};

function CommentSheet({ visible, postId, onClose, onCountChange, currentUserId, profile, colors }: CommentSheetProps) {
  const router = useRouter();
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!visible || !postId) return;
    setLoading(true);
    supabase
      .from("post_replies")
      .select("id, post_id, author_id, content, created_at, parent_reply_id")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50)
      .then(async ({ data }) => {
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
        if (mounted.current) setLoading(false);
      });
  }, [visible, postId]);

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
      const { data } = await supabase
        .from("post_replies")
        .select("id, post_id, author_id, content, created_at, parent_reply_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (mounted.current) {
        const list = (data ?? []) as PostReply[];
        const ids = [...new Set(list.map((r) => r.author_id))];
        if (ids.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, handle, avatar_url, is_verified")
            .in("id", ids);
          const pm = new Map((profiles ?? []).map((p: any) => [p.id, p as Profile]));
          setReplies(list.map((r) => ({ ...r, author: pm.get(r.author_id) })));
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not post comment");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const authorName = getDisplayName(profile);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={csh.backdrop} onPress={onClose} />
      <View style={[csh.sheet, { backgroundColor: colors.background }]}>
        <View style={[csh.handle, { backgroundColor: colors.border }]} />
        <View style={[csh.titleRow, { borderBottomColor: colors.border }]}>
          <Text style={[csh.title, { color: colors.foreground }]}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {loading ? (
          <View style={csh.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={csh.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {replies.length === 0 ? (
              <View style={csh.empty}>
                <Feather name="message-circle" size={32} color={colors.mutedForeground} />
                <Text style={[csh.emptyText, { color: colors.mutedForeground }]}>No comments yet. Be the first!</Text>
              </View>
            ) : (
              replies.map((r) => {
                const name = getDisplayName(r.author ?? null);
                return (
                  <View key={r.id} style={csh.commentRow}>
                    <Pressable onPress={() => { onClose(); setTimeout(() => router.push({ pathname: "/profile/[id]", params: { id: r.author_id } }), 300); }}>
                      <Avatar uri={r.author?.avatar_url} name={name} size={36} />
                    </Pressable>
                    <View style={[csh.bubble, { backgroundColor: colors.muted }]}>
                      <View style={csh.bubbleMeta}>
                        <Text style={[csh.commentName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
                        {r.author?.is_verified && <VerifiedBadge size={13} />}
                        <Text style={[csh.commentTime, { color: colors.mutedForeground }]}>· {timeAgo(r.created_at)}</Text>
                      </View>
                      <Text style={[csh.commentContent, { color: colors.foreground }]}>{r.content}</Text>
                      <Pressable onPress={() => { setReplyTo(name); setText(`@${r.author?.handle ?? name} `); Haptics.selectionAsync(); }}>
                        <Text style={[csh.replyBtn, { color: colors.primary }]}>Reply</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
        <View style={[csh.inputArea, { borderTopColor: colors.border }]}>
          {replyTo && (
            <View style={[csh.replyChip, { backgroundColor: colors.muted }]}>
              <Text style={[csh.replyChipText, { color: colors.primary }]}>↩ @{replyTo}</Text>
              <Pressable onPress={() => { setReplyTo(null); setText(""); }} hitSlop={8}>
                <Feather name="x" size={12} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
          <View style={csh.inputRow}>
            <Avatar uri={profile?.avatar_url} name={authorName} size={32} />
            <View style={[csh.inputWrap, { backgroundColor: colors.muted, borderColor: text ? colors.primary : "transparent" }]}>
              <TextInput
                style={[csh.input, { color: colors.foreground }]}
                placeholder="Add a comment…"
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={500}
              />
            </View>
            <Pressable
              style={[csh.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
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
      </View>
    </Modal>
  );
}

const csh = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "transparent" },
  sheet: { height: SCREEN_H * 0.65, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, gap: 0 },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  commentRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  bubble: { flex: 1, borderRadius: 14, padding: 10, gap: 3 },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentName: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  commentTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  commentContent: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  replyBtn: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  inputArea: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  replyChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: "flex-start" },
  replyChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  inputWrap: { flex: 1, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6 },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 72, lineHeight: 19, paddingTop: 0, paddingBottom: 0 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

// ── video item ────────────────────────────────────────────────────────────────

type VideoItemProps = {
  post: Post;
  isActive: boolean;
  isMuted: boolean;
  currentUserId: string;
  currentProfile: Profile | null;
  onLike: (id: string, nowLiked: boolean) => void;
  onCountChange: (id: string, delta: number) => void;
  onToggleMute: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  insets: { top: number; bottom: number };
};

function VideoItem({
  post, isActive, isMuted, currentUserId, currentProfile,
  onLike, onCountChange, onToggleMute, colors, insets,
}: VideoItemProps) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const pauseAnim = useRef(new Animated.Value(0)).current;
  const authorName = getDisplayName(post.author ?? null);
  const videoUrl = post.image_url;

  const player = useVideoPlayer(videoUrl ? { uri: videoUrl } : null, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    if (!player) return;
    if (isActive && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, paused, player]);

  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  const togglePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaused((p) => !p);
    Animated.sequence([
      Animated.timing(pauseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(pauseAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[vi.wrap, { height: ITEM_H }]}>
      {videoUrl && player ? (
        <Pressable style={vi.videoWrap} onPress={togglePause}>
          <VideoView
            style={vi.video}
            player={player}
            contentFit="cover"
            nativeControls={false}
          />
          <Animated.View style={[vi.pauseIcon, { opacity: pauseAnim }]}>
            <Ionicons name={paused ? "pause" : "play"} size={60} color="rgba(255,255,255,0.85)" />
          </Animated.View>
        </Pressable>
      ) : (
        <View style={[vi.videoWrap, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
          <Feather name="film" size={48} color="rgba(255,255,255,0.3)" />
        </View>
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.82)"]}
        style={vi.gradient}
        pointerEvents="none"
      />

      {/* Bottom-left: author + caption */}
      <View style={[vi.bottomLeft, { paddingBottom: insets.bottom + TAB_BAR_H - 20 }]}>
        <Pressable
          style={vi.authorRow}
          onPress={() => router.push({ pathname: "/profile/[id]", params: { id: post.author_id } })}
        >
          <Avatar uri={post.author?.avatar_url} name={authorName} size={36} />
          <View>
            <View style={vi.nameRow}>
              <Text style={vi.authorName} numberOfLines={1}>{authorName}</Text>
              {post.author?.is_verified && <VerifiedBadge size={14} />}
            </View>
            <Text style={vi.authorHandle} numberOfLines={1}>@{post.author?.handle}</Text>
          </View>
        </Pressable>
        {!!post.content && (
          <Text style={vi.caption} numberOfLines={3}>{post.content}</Text>
        )}
        <Text style={vi.timeStamp}>{timeAgo(post.created_at)}</Text>
      </View>

      {/* Right-side action buttons */}
      <View style={[vi.rightActions, { paddingBottom: insets.bottom + TAB_BAR_H - 10 }]}>
        <SideAction
          icon="heart"
          label={post.like_count ?? 0}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onLike(post.id, !post.liked_by_me); }}
          active={post.liked_by_me}
          activeColor="#EF4444"
        />
        <SideAction
          icon="message-circle"
          label={post.comment_count ?? 0}
          onPress={() => { setCommentsOpen(true); Haptics.selectionAsync(); }}
        />
        <SideAction
          icon="share-2"
          onPress={() => { Haptics.selectionAsync(); Alert.alert("Share", "Share functionality coming soon!"); }}
        />
        <SideAction
          icon={isMuted ? "volume-x" : "volume-2"}
          onPress={onToggleMute}
          active={isMuted}
          activeColor="#FF9500"
        />
      </View>

      <CommentSheet
        visible={commentsOpen}
        postId={post.id}
        onClose={() => setCommentsOpen(false)}
        onCountChange={(d) => onCountChange(post.id, d)}
        currentUserId={currentUserId}
        profile={currentProfile}
        colors={colors}
      />
    </View>
  );
}

const vi = StyleSheet.create({
  wrap: { width: SCREEN_W, backgroundColor: "#000" },
  videoWrap: { ...StyleSheet.absoluteFillObject },
  video: { width: SCREEN_W, height: SCREEN_H },
  pauseIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -30,
    marginLeft: -30,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_H * 0.55,
  },
  bottomLeft: { position: "absolute", left: 14, bottom: 0, right: 80, gap: 8 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorName: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  authorHandle: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" },
  caption: { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  timeStamp: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_400Regular" },
  rightActions: { position: "absolute", right: 10, bottom: 0, alignItems: "center", gap: 18 },
});

// ── feed screen ───────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadVideos = useCallback(async () => {
    try {
      const { data, error: qErr } = await supabase
        .from("posts")
        .select("id, author_id, content, image_url, like_count, comment_count, created_at")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (qErr) throw qErr;

      const list = (data ?? []) as Post[];
      const authorIds = [...new Set(list.map((p) => p.author_id))];

      const [profilesRes, likedRes] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("id, display_name, handle, avatar_url, is_verified").in("id", authorIds)
          : Promise.resolve({ data: [] as Profile[] }),
        user
          ? supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", list.map((p) => p.id))
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);

      const pMap = new Map(((profilesRes as any).data ?? []).map((p: Profile) => [p.id, p]));
      const likedSet = new Set(((likedRes as any).data ?? []).map((l: { post_id: string }) => l.post_id));

      const enriched = list.map((p) => ({
        ...p,
        like_count: p.like_count ?? 0,
        comment_count: p.comment_count ?? 0,
        author: pMap.get(p.author_id) as Profile | undefined,
        liked_by_me: likedSet.has(p.id),
      }));

      if (mounted.current) { setPosts(enriched); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load videos");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

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
        await supabase.from("post_likes").upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
        const post = posts.find((p) => p.id === postId);
        await supabase.from("posts").update({ like_count: Math.max(0, (post?.like_count ?? 0) + 1) }).eq("id", postId);
      } else {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
        const post = posts.find((p) => p.id === postId);
        await supabase.from("posts").update({ like_count: Math.max(0, (post?.like_count ?? 0) - 1) }).eq("id", postId);
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

  const handleCountChange = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) + delta) } : p
      )
    );
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  if (loading) {
    return (
      <View style={[fs.centered, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[fs.centered, { backgroundColor: "#000" }]}>
        <Feather name="alert-circle" size={36} color="rgba(255,255,255,0.6)" />
        <Text style={fs.errorTitle}>Could not load videos</Text>
        <Text style={fs.errorSub}>{error}</Text>
        <Pressable style={fs.retryBtn} onPress={loadVideos}>
          <Text style={fs.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={[fs.centered, { backgroundColor: "#000" }]}>
        <View style={fs.emptyIcon}>
          <Feather name="film" size={42} color="rgba(255,255,255,0.4)" />
        </View>
        <Text style={fs.emptyTitle}>No videos yet</Text>
        <Text style={fs.emptySub}>Videos will appear here when available</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={[fs.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="none">
        <Text style={fs.topTitle}>Videos</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => (
          <VideoItem
            post={item}
            isActive={index === activeIndex}
            isMuted={isMuted}
            currentUserId={user?.id ?? ""}
            currentProfile={profile}
            onLike={handleLike}
            onCountChange={handleCountChange}
            onToggleMute={() => setIsMuted((m) => !m)}
            colors={colors}
            insets={insets}
          />
        )}
        pagingEnabled
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(_data, index) => ({
          length: ITEM_H,
          offset: ITEM_H * index,
          index,
        })}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
        removeClippedSubviews
      />
    </View>
  );
}

const fs = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  topTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  errorTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  errorSub: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)" },
  retryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySub: { color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 240 },
});
