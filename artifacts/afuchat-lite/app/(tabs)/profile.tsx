import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";

import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { getDisplayName } from "@/lib/supabase";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type MenuItemProps = {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
  showSeparator?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  destructive?: boolean;
};

function MenuItem({
  icon, iconColor, label, value, badge, badgeColor, onPress,
  showSeparator, colors, destructive,
}: MenuItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: Platform.OS !== "web", speed: 60, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 40, bounciness: 4 }).start();

  return (
    <>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={mi.row}
          onPress={() => { Haptics.selectionAsync(); onPress(); }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={1}
        >
          <View style={[mi.iconWrap, { backgroundColor: iconColor + "18" }]}>
            <Ionicons name={icon as any} size={19} color={iconColor} />
          </View>
          <Text
            style={[mi.label, { color: destructive ? "#FF3B30" : colors.foreground }]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View style={mi.right}>
            {!!value && (
              <Text style={[mi.value, { color: colors.mutedForeground }]} numberOfLines={1}>
                {value}
              </Text>
            )}
            {!!badge && (
              <View style={[mi.badge, { backgroundColor: (badgeColor || colors.primary) + "20" }]}>
                <Text style={[mi.badgeText, { color: badgeColor || colors.primary }]}>{badge}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground + "80"} />
          </View>
        </TouchableOpacity>
      </Animated.View>
      {showSeparator && <View style={[mi.sep, { backgroundColor: colors.border }]} />}
    </>
  );
}

const mi = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { fontSize: 13, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <Text style={[sl.text, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
  );
}
const sl = StyleSheet.create({
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
});

function MenuCard({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={[mc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}
const mc = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});

// ─── Profile completion bar ───────────────────────────────────────────────────

function ProfileCompletionBar({
  profile,
  colors,
}: {
  profile: { avatar_url?: string | null; bio?: string | null; handle?: string | null; display_name?: string | null } | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const checks = [
    { label: "Photo", done: !!profile?.avatar_url },
    { label: "Name", done: !!profile?.display_name },
    { label: "Handle", done: !!profile?.handle },
    { label: "Bio", done: !!profile?.bio },
  ];
  const score = checks.filter((c) => c.done).length;
  const pct = score / checks.length;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct,
      duration: 900,
      delay: 400,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  if (score === checks.length) return null;

  return (
    <View style={{ gap: 6 }}>
      <SectionLabel label="Profile" colors={colors} />
      <MenuCard colors={colors}>
        <TouchableOpacity
          style={pc.wrap}
          onPress={() => router.push("/profile/edit")}
          activeOpacity={0.8}
        >
          <View style={pc.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={[pc.title, { color: colors.foreground }]}>Complete your profile</Text>
              <Text style={[pc.sub, { color: colors.mutedForeground }]}>
                {score} of {checks.length} steps done
              </Text>
            </View>
            <View style={[pc.pctBubble, { backgroundColor: colors.primary + "18" }]}>
              <Text style={[pc.pctText, { color: colors.primary }]}>
                {Math.round(pct * 100)}%
              </Text>
            </View>
          </View>
          <View style={[pc.track, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                pc.fill,
                {
                  backgroundColor: colors.primary,
                  width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                },
              ]}
            />
          </View>
          <View style={pc.checks}>
            {checks.map((c) => (
              <View key={c.label} style={pc.checkItem}>
                <Ionicons
                  name={c.done ? "checkmark-circle" : "ellipse-outline"}
                  size={14}
                  color={c.done ? "#34C759" : colors.border}
                />
                <Text
                  style={[
                    pc.checkLabel,
                    { color: c.done ? colors.mutedForeground : colors.mutedForeground + "66" },
                  ]}
                >
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </MenuCard>
    </View>
  );
}

const pc = StyleSheet.create({
  wrap: { padding: 14, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 1 },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pctBubble: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pctText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
  checks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  checkLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, signOut, user } = useAuth();
  const { isOnline: netOnline, pendingCount } = useOffline();
  const { themeMode, toggleTheme } = useTheme();

  const name = getDisplayName(profile);

  const confirmSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <OfflineBanner />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Blue header banner ─────────────────────────────────── */}
        <View
          style={[
            styles.headerBanner,
            { paddingTop: Platform.OS === "android" ? insets.top + 12 : insets.top + 4 },
          ]}
        >
          <View style={styles.bannerTitleRow}>
            <Text style={styles.bannerTitle}>My Profile</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                style={styles.editBtn}
                onPress={() => { Haptics.selectionAsync(); toggleTheme(); }}
                hitSlop={8}
              >
                <Ionicons
                  name={themeMode === "dark" ? "sunny" : "moon"}
                  size={16}
                  color="#fff"
                />
              </Pressable>
              <Pressable
                style={styles.editBtn}
                onPress={() => { Haptics.selectionAsync(); router.push("/profile/edit"); }}
                hitSlop={8}
              >
                <Ionicons name="pencil" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Avatar + name */}
          <View style={styles.avatarArea}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.push("/profile/edit"); }}
              style={styles.avatarRing}
            >
              <Avatar
                uri={profile?.avatar_url}
                name={name}
                size={92}
              />
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </Pressable>

            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{name}</Text>
                {profile?.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={11} color="#1E90FF" />
                  </View>
                )}
              </View>
              <Text style={styles.profileHandle}>@{profile?.handle}</Text>
              {profile?.bio ? (
                <Text style={styles.profileBio} numberOfLines={2}>{profile.bio}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Stats row */}
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {profile?.acoin ? fmtCount(profile.acoin) : "0"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ACoins</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {netOnline ? "Online" : "Offline"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Status</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {timeAgo(profile?.last_seen)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Last seen</Text>
            </View>
          </View>

          {/* Profile completion */}
          <ProfileCompletionBar profile={profile} colors={colors} />

          {/* Account section */}
          <View style={{ gap: 6 }}>
            <SectionLabel label="Account" colors={colors} />
            <MenuCard colors={colors}>
              <MenuItem
                icon="person-outline"
                iconColor="#1E90FF"
                label="Edit Profile"
                value={profile?.display_name ?? undefined}
                onPress={() => router.push("/profile/edit")}
                showSeparator
                colors={colors}
              />
              <MenuItem
                icon="mail-outline"
                iconColor="#5AC8FA"
                label="Email"
                value={user?.email ?? "—"}
                onPress={() => {}}
                showSeparator
                colors={colors}
              />
              <MenuItem
                icon="at-outline"
                iconColor="#34C759"
                label="Handle"
                value={profile?.handle ? `@${profile.handle}` : undefined}
                onPress={() => router.push("/profile/edit")}
                colors={colors}
              />
            </MenuCard>
          </View>

          {/* App section */}
          <View style={{ gap: 6 }}>
            <SectionLabel label="App" colors={colors} />
            <MenuCard colors={colors}>
              <MenuItem
                icon="wifi-outline"
                iconColor={netOnline ? "#34C759" : "#FF3B30"}
                label="Connection"
                value={
                  netOnline
                    ? "Online"
                    : pendingCount > 0
                    ? `Offline · ${pendingCount} queued`
                    : "Offline"
                }
                onPress={() => {}}
                showSeparator
                colors={colors}
              />
              <MenuItem
                icon="information-circle-outline"
                iconColor="#8E8E93"
                label="Version"
                value="1.0.0 (SDK 55)"
                onPress={() => {}}
                colors={colors}
              />
            </MenuCard>
          </View>

          {/* Sign out */}
          <View style={{ gap: 6 }}>
            <SectionLabel label="Session" colors={colors} />
            <MenuCard colors={colors}>
              <MenuItem
                icon="log-out-outline"
                iconColor="#FF3B30"
                label="Sign Out"
                onPress={confirmSignOut}
                colors={colors}
                destructive
              />
            </MenuCard>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  headerBanner: {
    backgroundColor: "#1E90FF",
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  bannerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 20,
  },
  bannerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarArea: { alignItems: "center", gap: 14 },
  avatarRing: {
    padding: 3,
    borderRadius: 52,
    backgroundColor: "rgba(255,255,255,0.25)",
    position: "relative",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 3,
    right: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E90FF",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  nameBlock: { alignItems: "center", gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.3 },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  profileHandle: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  profileBio: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },

  body: { marginTop: -48, paddingHorizontal: 16, gap: 16 },

  statsRow: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: { alignItems: "center", gap: 3, flex: 1 },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
});
