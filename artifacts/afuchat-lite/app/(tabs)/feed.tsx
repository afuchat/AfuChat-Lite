import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
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
import { FeedItemSkeleton } from "@/components/Skeleton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getCachedUri, preloadVideos } from "@/lib/videoCache";
import { Post, PostReply, Profile, getDisplayName, supabase } from "@/lib/supabase";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const TAB_BAR_H = 96;
const ITEM_H = SCREEN_H;

// ── post type detection ────────────────────────────────────────────────────────

type PostKind = "video" | "image" | "text";

function detectKind(post: Post): PostKind {
  if (!post.image_url) return "text";
  const url = post.image_url.toLowerCase().split("?")[0].split(",")[0].trim();
  if (
    url.endsWith(".mp4") ||
    url.endsWith(".mov") ||
    url.endsWith(".webm") ||
    url.endsWith(".m3u8") ||
    url.includes("/video/") ||
    url.includes("video")
  )
    return "video";
  return "image";
}

function parseImageUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── gradient palette for text posts ──────────────────────────────────────────

const GRADIENTS: [string, string][] = [
  ["#1a1a2e", "#16213e"],
  ["#0f0c29", "#302b63"],
  ["#141e30", "#243b55"],
  ["#1f1c2c", "#928dab"],
  ["#0d0d0d", "#1a1a1a"],
  ["#200122", "#6f0000"],
  ["#000428", "#004e92"],
];

function pickGradient(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
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
      Animated.spring(scale, { toValue: 1.45, useNativeDriver: true, speed: 300, bounciness: 14 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 5 }),
    ]).start();
  };

  return (
    <Pressable style={sa.wrap} onPress={() => { pulse(); onPress(); }} hitSlop={8}>
      <Animated.View style={[sa.iconBox, { transform: [{ scale }] }]}>
        <View style={[sa.iconBg, active && { backgroundColor: (activeColor ?? "#EF4444") + "28" }]}>
          <Feather name={icon as any} size={26} color={active ? (activeColor ?? "#EF4444") : "#fff"} />
        </View>
      </Animated.View>
      {label !== undefined && label !== "" && (
        <Text style={sa.label}>{typeof label === "number" ? fmtCount(label) : label}</Text>
      )}
    </Pressable>
  );
}

const sa = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  iconBox: {},
  iconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  label: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

// ── overlay footer (author + caption) ────────────────────────────────────────

function ItemFooter({
  post,
  insets,
  extraBottom = 0,
}: {
  post: Post;
  insets: { bottom: number };
  extraBottom?: number;
}) {
  const router = useRouter();
  const authorName = getDisplayName(post.author ?? null);
  return (
    <View style={[ft.wrap, { paddingBottom: insets.bottom + TAB_BAR_H + extraBottom }]}>
      <Pressable
        style={ft.authorRow}
        onPress={() => router.push({ pathname: "/profile/[id]", params: { id: post.author_id } })}
      >
        <Avatar uri={post.author?.avatar_url} name={authorName} size={38} />
        <View>
          <View style={ft.nameRow}>
            <Text style={ft.name} numberOfLines={1}>{authorName}</Text>
            {post.author?.is_verified && <VerifiedBadge size={20} />}
          </View>
          <Text style={ft.handle} numberOfLines={1}>@{post.author?.handle}</Text>
        </View>
      </Pressable>
      {!!post.content && (
        <Text style={ft.caption} numberOfLines={4}>{post.content}</Text>
      )}
      <Text style={ft.time}>{timeAgo(post.created_at)}</Text>
    </View>
  );
}

const ft = StyleSheet.create({
  wrap: { position: "absolute", left: 14, bottom: 0, right: 84, gap: 9 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  handle: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_400Regular" },
  caption: { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  time: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" },
});

// ── action column ─────────────────────────────────────────────────────────────

function ActionColumn({
  post,
  insets,
  isMuted,
  onLike,
  onComment,
  onToggleMute,
}: {
  post: Post;
  insets: { bottom: number };
  isMuted: boolean;
  onLike: () => void;
  onComment: () => void;
  onToggleMute: () => void;
}) {
  return (
    <View style={[ac.wrap, { paddingBottom: insets.bottom + TAB_BAR_H }]}>
      <SideAction
        icon="heart"
        label={post.like_count ?? 0}
        onPress={onLike}
        active={post.liked_by_me}
        activeColor="#EF4444"
      />
      <SideAction
        icon="message-circle"
        label={post.comment_count ?? 0}
        onPress={onComment}
      />
      <SideAction
        icon="share-2"
        onPress={() => { Haptics.selectionAsync(); Alert.alert("Share", "Share coming soon!"); }}
      />
      <SideAction
        icon={isMuted ? "volume-x" : "volume-2"}
        onPress={onToggleMute}
        active={isMuted}
        activeColor="#FF9500"
      />
    </View>
  );
}

const ac = StyleSheet.create({
  wrap: { position: "absolute", right: 10, bottom: 0, alignItems: "center", gap: 16 },
});

// ── comments sheet ────────────────────────────────────────────────────────────

function CommentSheet({
  visible,
  postId,
  onClose,
  onCountChange,
  currentUserId,
  profile,
  colors,
}: {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onCountChange: (delta: number) => void;
  currentUserId: string;
  profile: Profile | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
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
      .limit(60)
      .then(async ({ data }) => {
        const list = (data ?? []) as PostReply[];
        const ids = [...new Set(list.map((r) => r.author_id))];
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name, handle, avatar_url, is_verified")
            .in("id", ids);
          const pm = new Map((profs ?? []).map((p: any) => [p.id, p as Profile]));
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
      await supabase.from("post_replies").insert({ post_id: postId, author_id: currentUserId, content });
      setText("");
      setReplyTo(null);
      onCountChange(1);
      const { data } = await supabase
        .from("post_replies")
        .select("id, post_id, author_id, content, created_at, parent_reply_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(60);
      if (mounted.current) {
        const list = (data ?? []) as PostReply[];
        const ids = [...new Set(list.map((r) => r.author_id))];
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name, handle, avatar_url, is_verified")
            .in("id", ids);
          const pm = new Map((profs ?? []).map((p: any) => [p.id, p as Profile]));
          setReplies(list.map((r) => ({ ...r, author: pm.get(r.author_id) })));
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not post");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const authorName = getDisplayName(profile);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cs.backdrop} onPress={onClose} />
      <View style={[cs.sheet, { backgroundColor: colors.background }]}>
        <View style={[cs.handle, { backgroundColor: colors.border }]} />
        <View style={[cs.titleRow, { borderBottomColor: colors.border }]}>
          <Text style={[cs.title, { color: colors.foreground }]}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {loading ? (
          <View style={cs.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={cs.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {replies.length === 0 ? (
              <View style={cs.empty}>
                <Feather name="message-circle" size={32} color={colors.mutedForeground} />
                <Text style={[cs.emptyText, { color: colors.mutedForeground }]}>No comments yet. Be the first!</Text>
              </View>
            ) : (
              replies.map((r) => {
                const n = getDisplayName(r.author ?? null);
                return (
                  <View key={r.id} style={cs.row}>
                    <Pressable onPress={() => { onClose(); setTimeout(() => router.push({ pathname: "/profile/[id]", params: { id: r.author_id } }), 300); }}>
                      <Avatar uri={r.author?.avatar_url} name={n} size={36} />
                    </Pressable>
                    <View style={[cs.bubble, { backgroundColor: colors.muted }]}>
                      <View style={cs.meta}>
                        <Text style={[cs.cname, { color: colors.foreground }]} numberOfLines={1}>{n}</Text>
                        {r.author?.is_verified && <VerifiedBadge size={14} />}
                        <Text style={[cs.ctime, { color: colors.mutedForeground }]}>· {timeAgo(r.created_at)}</Text>
                      </View>
                      <Text style={[cs.cbody, { color: colors.foreground }]}>{r.content}</Text>
                      <Pressable onPress={() => { setReplyTo(n); setText(`@${r.author?.handle ?? n} `); Haptics.selectionAsync(); }}>
                        <Text style={[cs.replyBtn, { color: colors.primary }]}>Reply</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
        <View style={[cs.inputArea, { borderTopColor: colors.border }]}>
          {replyTo && (
            <View style={[cs.chip, { backgroundColor: colors.muted }]}>
              <Text style={[cs.chipText, { color: colors.primary }]}>↩ @{replyTo}</Text>
              <Pressable onPress={() => { setReplyTo(null); setText(""); }} hitSlop={8}>
                <Feather name="x" size={12} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
          <View style={cs.inputRow}>
            <Avatar uri={profile?.avatar_url} name={authorName} size={32} />
            <View style={[cs.inputWrap, { backgroundColor: colors.muted, borderColor: text ? colors.primary : "transparent" }]}>
              <TextInput
                style={[cs.input, { color: colors.foreground }]}
                placeholder="Add a comment…"
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={500}
              />
            </View>
            <Pressable
              style={[cs.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
              onPress={submit}
              disabled={!text.trim() || submitting}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={14} color={text.trim() ? "#fff" : colors.mutedForeground} />}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "transparent" },
  sheet: { height: SCREEN_H * 0.65, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 0, paddingBottom: 24 },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  row: { flexDirection: "row", gap: 10, marginBottom: 16 },
  bubble: { flex: 1, borderRadius: 14, padding: 10, gap: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  cname: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  ctime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cbody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  replyBtn: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  inputArea: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: "flex-start" },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  inputWrap: { flex: 1, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6 },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 72, lineHeight: 19, paddingTop: 0, paddingBottom: 0 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

// ── VIDEO item ────────────────────────────────────────────────────────────────

function VideoItem({
  post,
  isActive,
  isMuted,
  insets,
  onLike,
  onCountChange,
  onToggleMute,
  currentUserId,
  currentProfile,
  colors,
}: {
  post: Post;
  isActive: boolean;
  isMuted: boolean;
  insets: { top: number; bottom: number };
  onLike: () => void;
  onCountChange: (delta: number) => void;
  onToggleMute: () => void;
  currentUserId: string;
  currentProfile: Profile | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [cachedUri, setCachedUri] = useState(post.image_url ?? "");
  const pauseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!post.image_url) return;
    getCachedUri(post.image_url).then((uri) => setCachedUri(uri));
  }, [post.image_url]);

  const player = useVideoPlayer(cachedUri ? { uri: cachedUri } : null, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    if (!player) return;
    if (isActive && !paused) player.play();
    else player.pause();
  }, [isActive, paused, player]);

  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  const togglePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaused((p) => !p);
    Animated.sequence([
      Animated.timing(pauseAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(pauseAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[vi.wrap, { height: ITEM_H }]}>
      <Pressable style={vi.fill} onPress={togglePause}>
        {cachedUri && player ? (
          <VideoView style={vi.video} player={player} contentFit="cover" nativeControls={false} />
        ) : (
          <View style={[vi.fill, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
        <Animated.View style={[vi.pauseIcon, { opacity: pauseAnim }]}>
          <View style={vi.pauseCircle}>
            <Ionicons name={paused ? "pause" : "play"} size={40} color="#fff" />
          </View>
        </Animated.View>
      </Pressable>

      <LinearGradient colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.88)"]} style={vi.gradient} pointerEvents="none" />

      <ItemFooter post={post} insets={insets} />
      <ActionColumn post={post} insets={insets} isMuted={isMuted} onLike={onLike} onComment={() => { setCommentsOpen(true); Haptics.selectionAsync(); }} onToggleMute={onToggleMute} />

      <CommentSheet
        visible={commentsOpen}
        postId={post.id}
        onClose={() => setCommentsOpen(false)}
        onCountChange={onCountChange}
        currentUserId={currentUserId}
        profile={currentProfile}
        colors={colors}
      />
    </View>
  );
}

const vi = StyleSheet.create({
  wrap: { width: SCREEN_W, backgroundColor: "#000" },
  fill: { ...StyleSheet.absoluteFillObject },
  video: { width: SCREEN_W, height: SCREEN_H },
  gradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: SCREEN_H * 0.6 },
  pauseIcon: { position: "absolute", top: "50%", left: "50%", marginTop: -36, marginLeft: -36 },
  pauseCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
});

// ── IMAGE item ────────────────────────────────────────────────────────────────

function ImageItem({
  post,
  insets,
  isMuted,
  onLike,
  onCountChange,
  onToggleMute,
  currentUserId,
  currentProfile,
  colors,
}: {
  post: Post;
  insets: { top: number; bottom: number };
  isMuted: boolean;
  onLike: () => void;
  onCountChange: (delta: number) => void;
  onToggleMute: () => void;
  currentUserId: string;
  currentProfile: Profile | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const images = useMemo(() => parseImageUrls(post.image_url), [post.image_url]);

  return (
    <View style={[im.wrap, { height: ITEM_H }]}>
      {/* Full-screen horizontal image carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setImgIndex(idx);
        }}
        scrollEventThrottle={16}
        style={im.scroll}
      >
        {images.map((uri, i) => (
          <View key={i} style={im.imageSlide}>
            <Image
              source={{ uri }}
              style={im.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </View>
        ))}
      </ScrollView>

      {/* Slide dots (if multiple images) */}
      {images.length > 1 && (
        <View style={[im.dots, { top: insets.top + 54 }]}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[im.dot, i === imgIndex ? im.dotActive : im.dotInactive]}
            />
          ))}
        </View>
      )}

      <LinearGradient colors={["rgba(0,0,0,0.22)", "transparent"]} style={im.topGrad} pointerEvents="none" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.88)"]} style={im.gradient} pointerEvents="none" />

      <ItemFooter post={post} insets={insets} />
      <ActionColumn post={post} insets={insets} isMuted={isMuted} onLike={onLike} onComment={() => { setCommentsOpen(true); Haptics.selectionAsync(); }} onToggleMute={onToggleMute} />

      {images.length > 1 && (
        <View style={[im.slideHint, { top: insets.top + 90 }]} pointerEvents="none">
          <Feather name="chevrons-right" size={18} color="rgba(255,255,255,0.6)" />
          <Text style={im.slideHintText}>{imgIndex + 1} / {images.length}</Text>
        </View>
      )}

      <CommentSheet
        visible={commentsOpen}
        postId={post.id}
        onClose={() => setCommentsOpen(false)}
        onCountChange={onCountChange}
        currentUserId={currentUserId}
        profile={currentProfile}
        colors={colors}
      />
    </View>
  );
}

const im = StyleSheet.create({
  wrap: { width: SCREEN_W, backgroundColor: "#000" },
  scroll: { ...StyleSheet.absoluteFillObject },
  imageSlide: { width: SCREEN_W, height: SCREEN_H },
  image: { width: SCREEN_W, height: SCREEN_H },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  gradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: SCREEN_H * 0.55 },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    zIndex: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: "#fff", width: 18 },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.45)" },
  slideHint: {
    position: "absolute",
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slideHintText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
});

// ── TEXT item ─────────────────────────────────────────────────────────────────

function TextItem({
  post,
  insets,
  isMuted,
  onLike,
  onCountChange,
  onToggleMute,
  currentUserId,
  currentProfile,
  colors,
}: {
  post: Post;
  insets: { top: number; bottom: number };
  isMuted: boolean;
  onLike: () => void;
  onCountChange: (delta: number) => void;
  onToggleMute: () => void;
  currentUserId: string;
  currentProfile: Profile | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [bg0, bg1] = pickGradient(post.id);

  return (
    <View style={[tx.wrap, { height: ITEM_H }]}>
      <LinearGradient colors={[bg0, bg1]} style={StyleSheet.absoluteFill} />

      {/* Centered text content */}
      <View style={[tx.textArea, { paddingBottom: insets.bottom + TAB_BAR_H + 80 }]}>
        <Text style={tx.body} numberOfLines={12}>{post.content}</Text>
      </View>

      <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={tx.bottomFade} pointerEvents="none" />

      <ItemFooter post={post} insets={insets} />
      <ActionColumn post={post} insets={insets} isMuted={isMuted} onLike={onLike} onComment={() => { setCommentsOpen(true); Haptics.selectionAsync(); }} onToggleMute={onToggleMute} />

      <CommentSheet
        visible={commentsOpen}
        postId={post.id}
        onClose={() => setCommentsOpen(false)}
        onCountChange={onCountChange}
        currentUserId={currentUserId}
        profile={currentProfile}
        colors={colors}
      />
    </View>
  );
}

const tx = StyleSheet.create({
  wrap: { width: SCREEN_W },
  textArea: {
    position: "absolute",
    top: "20%",
    left: 28,
    right: 90,
    bottom: 0,
    justifyContent: "center",
  },
  body: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: SCREEN_H * 0.45 },
});

// ── feed screen ───────────────────────────────────────────────────────────────

const SKELETON_KEYS = ["sk-0", "sk-1", "sk-2"];

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

  const loadPosts = useCallback(async () => {
    try {
      const { data, error: qErr } = await supabase
        .from("posts")
        .select("id, author_id, content, image_url, like_count, comment_count, created_at")
        .order("created_at", { ascending: false })
        .limit(60);

      if (qErr) throw qErr;

      const list = (data ?? []) as Post[];
      const authorIds = [...new Set(list.map((p) => p.author_id))];

      const [profilesRes, likedRes] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("id, display_name, handle, avatar_url, is_verified").in("id", authorIds)
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", list.map((p) => p.id))
          : Promise.resolve({ data: [] }),
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

      const videoUrls = enriched
        .filter((p) => detectKind(p) === "video" && p.image_url)
        .slice(0, 3)
        .map((p) => p.image_url!);
      if (videoUrls.length) preloadVideos(videoUrls);
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Failed to load");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleLike = useCallback(async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const nowLiked = !post.liked_by_me;
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
        await supabase.from("posts").update({ like_count: Math.max(0, (post.like_count ?? 0) + 1) }).eq("id", postId);
      } else {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
        await supabase.from("posts").update({ like_count: Math.max(0, (post.like_count ?? 0) - 1) }).eq("id", postId);
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked_by_me: !nowLiked, like_count: Math.max(0, (p.like_count ?? 0) + (nowLiked ? -1 : 1)) } : p
        )
      );
    }
  }, [user, posts]);

  const handleCountChange = useCallback((postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) + delta) } : p)
    );
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  type FeedItem = Post | { _skeleton: string };

  const listData: FeedItem[] = loading
    ? SKELETON_KEYS.map((k) => ({ _skeleton: k }))
    : posts;

  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
    if ("_skeleton" in item) {
      return <FeedItemSkeleton />;
    }

    const post = item as Post;
    const kind = detectKind(post);
    const shared = {
      post,
      isActive: index === activeIndex,
      isMuted,
      insets,
      onLike: () => handleLike(post.id),
      onCountChange: (d: number) => handleCountChange(post.id, d),
      onToggleMute: () => setIsMuted((m) => !m),
      currentUserId: user?.id ?? "",
      currentProfile: profile,
      colors,
    };

    if (kind === "video") return <VideoItem {...shared} />;
    if (kind === "image") return <ImageItem {...shared} />;
    return <TextItem {...shared} />;
  }, [activeIndex, isMuted, insets, handleLike, handleCountChange, user, profile, colors]);

  if (error && !loading) {
    return (
      <View style={[fs.centered, { backgroundColor: "#000" }]}>
        <Feather name="alert-circle" size={36} color="rgba(255,255,255,0.6)" />
        <Text style={fs.errTitle}>Could not load</Text>
        <Text style={fs.errSub}>{error}</Text>
        <Pressable style={fs.retryBtn} onPress={loadPosts}>
          <Text style={fs.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <View style={[fs.centered, { backgroundColor: "#000" }]}>
        <View style={fs.emptyIcon}>
          <Feather name="film" size={42} color="rgba(255,255,255,0.4)" />
        </View>
        <Text style={fs.emptyTitle}>Nothing here yet</Text>
        <Text style={fs.emptySub}>Videos, images, and posts will appear here</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={[fs.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="none">
        <Text style={fs.topTitle}>Videos</Text>
      </View>

      <FlatList
        data={listData as any[]}
        keyExtractor={(item) => ("_skeleton" in item ? item._skeleton : (item as Post).id)}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(_data, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews
      />
    </View>
  );
}

const fs = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  topTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  errTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  errSub: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)" },
  retryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySub: { color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 240 },
});
