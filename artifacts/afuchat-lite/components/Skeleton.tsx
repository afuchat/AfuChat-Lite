import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: ViewStyle;
  dark?: boolean;
};

export function Skeleton({ width = "100%", height = 16, radius = 6, style, dark }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: dark ? [0.12, 0.28] : [0.06, 0.16] });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius: radius,
          backgroundColor: dark ? "#fff" : "#000",
          opacity,
        },
        style,
      ]}
    />
  );
}

export function FeedItemSkeleton() {
  return (
    <View style={sk.wrap}>
      {/* Right action buttons */}
      <View style={sk.rightActions}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={sk.actionSlot}>
            <Skeleton width={44} height={44} radius={22} dark />
            <Skeleton width={30} height={10} radius={5} dark style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>

      {/* Bottom author + caption */}
      <View style={sk.bottomLeft}>
        <View style={sk.authorRow}>
          <Skeleton width={40} height={40} radius={20} dark />
          <View style={sk.authorText}>
            <Skeleton width={130} height={14} radius={7} dark />
            <Skeleton width={80} height={10} radius={5} dark style={{ marginTop: 6 }} />
          </View>
        </View>
        <Skeleton width="90%" height={12} radius={6} dark style={{ marginTop: 10 }} />
        <Skeleton width="70%" height={12} radius={6} dark style={{ marginTop: 6 }} />
        <Skeleton width="50%" height={10} radius={5} dark style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function ChatListSkeleton() {
  const colors = useColors();
  return (
    <View style={[cls.wrap, { backgroundColor: colors.background }]}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={[cls.row, { borderBottomColor: colors.border }]}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={cls.text}>
            <Skeleton width={140} height={14} radius={7} />
            <Skeleton width={200} height={11} radius={5} style={{ marginTop: 6 }} />
          </View>
          <View style={cls.meta}>
            <Skeleton width={36} height={10} radius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProfileSkeleton() {
  const colors = useColors();
  return (
    <View style={[ps.wrap, { backgroundColor: colors.background }]}>
      <Skeleton width={90} height={90} radius={45} style={{ alignSelf: "center", marginTop: 24 }} />
      <Skeleton width={160} height={18} radius={9} style={{ alignSelf: "center", marginTop: 14 }} />
      <Skeleton width={100} height={12} radius={6} style={{ alignSelf: "center", marginTop: 8 }} />
      <View style={ps.statsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={ps.statItem}>
            <Skeleton width={40} height={20} radius={8} />
            <Skeleton width={50} height={10} radius={5} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} width="90%" height={14} radius={7} style={{ alignSelf: "center", marginTop: 12 }} />
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: { width: SCREEN_W, height: SCREEN_H, backgroundColor: "#111" },
  rightActions: {
    position: "absolute",
    right: 14,
    bottom: 160,
    alignItems: "center",
    gap: 22,
  },
  actionSlot: { alignItems: "center" },
  bottomLeft: {
    position: "absolute",
    left: 14,
    bottom: 80,
    right: 80,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  authorText: { gap: 0 },
});

const cls = StyleSheet.create({
  wrap: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 0 },
  meta: { alignItems: "flex-end", gap: 6 },
});

const ps = StyleSheet.create({
  wrap: { flex: 1, paddingBottom: 40 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 24,
    marginHorizontal: 20,
    paddingVertical: 16,
  },
  statItem: { alignItems: "center" },
});
