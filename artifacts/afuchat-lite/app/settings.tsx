import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { getDisplayName } from "@/lib/supabase";

// ── AsyncStorage keys ─────────────────────────────────────────────────────────
const LAST_SEEN_KEY = "settings:lastSeenVisibility";
const READ_RECEIPTS_KEY = "settings:readReceipts";
const TYPING_KEY = "settings:typingIndicators";

// ── Reusable building blocks ──────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[sl.text, { color: colors.mutedForeground }]}>
      {label.toUpperCase()}
    </Text>
  );
}
const sl = StyleSheet.create({
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.9,
    marginBottom: 4,
    marginLeft: 4,
  },
});

function Section({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[sec.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}
const sec = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});

function Separator() {
  const colors = useColors();
  return <View style={[sep.line, { backgroundColor: colors.border }]} />;
}
const sep = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
});

type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  value?: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
};

function SettingsRow({
  icon,
  label,
  value,
  badge,
  badgeColor,
  onPress,
  right,
  destructive,
  disabled,
}: SettingsRowProps) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 3 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={sr.row}
        onPress={() => {
          if (disabled) return;
          Haptics.selectionAsync();
          onPress();
        }}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <View style={sr.iconSlot}>{icon}</View>
        <Text
          style={[
            sr.label,
            { color: destructive ? "#FF3B30" : disabled ? colors.mutedForeground : colors.foreground },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View style={sr.right}>
          {!!badge && (
            <View style={[sr.badge, { backgroundColor: (badgeColor ?? colors.primary) + "20" }]}>
              <Text style={[sr.badgeText, { color: badgeColor ?? colors.primary }]}>{badge}</Text>
            </View>
          )}
          {right ?? (
            <>
              {!!value && (
                <Text style={[sr.value, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {value}
                </Text>
              )}
              <Ionicons
                name="chevron-forward"
                size={15}
                color={colors.mutedForeground + "60"}
              />
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  iconSlot: { width: 32 },
  label: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { fontSize: 13, fontFamily: "Inter_400Regular", maxWidth: 150 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

function IconBox({ color, name }: { color: string; name: string }) {
  return (
    <View style={[ib.box, { backgroundColor: color + "1A" }]}>
      <Ionicons name={name as any} size={18} color={color} />
    </View>
  );
}
const ib = StyleSheet.create({
  box: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});

// ── Theme segment ─────────────────────────────────────────────────────────────

function ThemeSegment({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (m: ThemeMode) => void;
}) {
  const colors = useColors();
  const options: { label: string; value: ThemeMode; icon: string }[] = [
    { label: "Light", value: "light", icon: "sunny-outline" },
    { label: "Dark", value: "dark", icon: "moon-outline" },
    { label: "Auto", value: "system", icon: "contrast-outline" },
  ];
  return (
    <View style={[ts.segment, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[ts.option, active && { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 }]}
            onPress={() => { Haptics.selectionAsync(); onChange(opt.value); }}
          >
            <Ionicons name={opt.icon as any} size={13} color={active ? colors.primary : colors.mutedForeground} />
            <Text style={[ts.label, { color: active ? colors.primary : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const ts = StyleSheet.create({
  segment: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    gap: 2,
  },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

// ── Inline toggle row ─────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View style={tr.row}>
      <View style={tr.iconSlot}>{icon}</View>
      <View style={tr.text}>
        <Text style={[tr.label, { color: colors.foreground }]}>{label}</Text>
        {!!sub && <Text style={[tr.sub, { color: colors.mutedForeground }]}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
const tr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconSlot: { width: 32 },
  text: { flex: 1 },
  label: { fontSize: 15, fontFamily: "Inter_500Medium" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});

// ── Inline theme row (combined icon + label + segment) ────────────────────────

function ThemeRow({ value, onChange }: { value: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const colors = useColors();
  return (
    <View style={thr.row}>
      <IconBox color="#8E8E93" name="color-palette-outline" />
      <Text style={[thr.label, { color: colors.foreground }]}>Theme</Text>
      <ThemeSegment value={value} onChange={onChange} />
    </View>
  );
}
const thr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  label: { fontSize: 15, fontFamily: "Inter_500Medium", flex: 1 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, resetPassword, updateProfile } = useAuth();
  const { themeMode, setThemeMode } = useTheme();

  // ── Local state ────────────────────────────────────────────────────────────
  const [lastSeenHidden, setLastSeenHidden] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);

  const [pwState, setPwState] = useState<"idle" | "sending" | "sent">("idle");
  const [cacheState, setCacheState] = useState<"idle" | "clearing" | "cleared">("idle");

  const displayName = getDisplayName(profile);

  // ── Load persisted settings ────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.multiGet([LAST_SEEN_KEY, READ_RECEIPTS_KEY, TYPING_KEY]).then((pairs) => {
      const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (map[LAST_SEEN_KEY] === "nobody") setLastSeenHidden(true);
      if (map[READ_RECEIPTS_KEY] === "false") setReadReceipts(false);
      if (map[TYPING_KEY] === "false") setTypingIndicators(false);
    });
  }, []);

  const saveLastSeen = (hidden: boolean) => {
    setLastSeenHidden(hidden);
    AsyncStorage.setItem(LAST_SEEN_KEY, hidden ? "nobody" : "everyone");
  };

  const saveReadReceipts = (on: boolean) => {
    setReadReceipts(on);
    AsyncStorage.setItem(READ_RECEIPTS_KEY, String(on));
  };

  const saveTyping = (on: boolean) => {
    setTypingIndicators(on);
    AsyncStorage.setItem(TYPING_KEY, String(on));
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert("No email", "No email found for your account.");
      return;
    }
    setPwState("sending");
    const { error } = await resetPassword(user.email);
    if (error) {
      setPwState("idle");
      Alert.alert("Error", error);
    } else {
      setPwState("sent");
      setTimeout(() => setPwState("idle"), 6000);
    }
  };

  const handleClearCache = async () => {
    setCacheState("clearing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const keys = await AsyncStorage.getAllKeys();
    const targets = keys.filter(
      (k) => k.startsWith("profile:") || k.startsWith("lastRead:") || k.startsWith("cache:")
    );
    if (targets.length > 0) await AsyncStorage.multiRemove(targets);
    setCacheState("cleared");
    setTimeout(() => setCacheState("idle"), 3000);
  };

  const handleCopyEmail = () => {
    if (!user?.email) return;
    Alert.alert("Email Address", user.email, [{ text: "OK" }]);
    Haptics.selectionAsync();
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "You'll need to sign in again to use AfuChat.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "All your messages, posts and profile will be deleted forever.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Yes, delete everything",
                  style: "destructive",
                  onPress: async () => {
                    await signOut();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleNotificationPlaceholder = () => {
    Alert.alert("Coming Soon", "Push notifications will be available in a future update.");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* ── Top bar ─── */}
      <View style={[s.topBar, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[s.topTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 48 }]}
      >

        {/* ── Profile card ───────────────────────────────────────────────── */}
        <Pressable
          style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { Haptics.selectionAsync(); router.push("/profile/edit"); }}
        >
          <Avatar uri={profile?.avatar_url} name={displayName} size={60} />
          <View style={s.profileInfo}>
            <View style={s.profileNameRow}>
              <Text style={[s.profileName, { color: colors.foreground }]} numberOfLines={1}>
                {displayName}
              </Text>
              {profile?.is_verified && <VerifiedBadge size={18} />}
            </View>
            <Text style={[s.profileHandle, { color: colors.mutedForeground }]}>
              @{profile?.handle ?? "—"}
            </Text>
            {!!profile?.bio && (
              <Text style={[s.profileBio, { color: colors.mutedForeground }]} numberOfLines={1}>
                {profile.bio}
              </Text>
            )}
          </View>
          <View style={[s.editChip, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[s.editChipText, { color: colors.primary }]}>Edit</Text>
          </View>
        </Pressable>

        {/* ── Account ──────────────────────────────────────────────────────── */}
        <View style={s.group}>
          <SectionLabel label="Account" />
          <Section>
            <SettingsRow
              icon={<IconBox color="#5AC8FA" name="mail-outline" />}
              label="Email"
              value={user?.email ?? "—"}
              onPress={handleCopyEmail}
              right={
                <View style={s.rowRight}>
                  <Text style={[s.valueText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {user?.email ?? "—"}
                  </Text>
                  <Feather name="copy" size={13} color={colors.mutedForeground + "80"} />
                </View>
              }
            />
            <Separator />
            <SettingsRow
              icon={<IconBox color="#34C759" name="at-outline" />}
              label="Handle"
              value={profile?.handle ? `@${profile.handle}` : "—"}
              onPress={() => router.push("/profile/edit")}
            />
            <Separator />
            <SettingsRow
              icon={<IconBox color="#FF9500" name="key-outline" />}
              label={
                pwState === "sending" ? "Sending email…"
                : pwState === "sent" ? "Email sent ✓"
                : "Change Password"
              }
              onPress={handleChangePassword}
              disabled={pwState === "sending"}
              right={
                pwState === "sent" ? (
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                ) : pwState === "sending" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground + "60"} />
                )
              }
            />
          </Section>
        </View>

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <View style={s.group}>
          <SectionLabel label="Appearance" />
          <Section>
            <ThemeRow value={themeMode} onChange={setThemeMode} />
          </Section>
        </View>

        {/* ── Privacy ──────────────────────────────────────────────────────── */}
        <View style={s.group}>
          <SectionLabel label="Privacy" />
          <Section>
            <ToggleRow
              icon={<IconBox color="#1E90FF" name="time-outline" />}
              label="Hide Last Seen"
              sub={lastSeenHidden ? "Others can't see when you were active" : "Everyone sees your activity time"}
              value={lastSeenHidden}
              onChange={saveLastSeen}
            />
            <Separator />
            <ToggleRow
              icon={<IconBox color="#34C759" name="checkmark-done-outline" />}
              label="Read Receipts"
              sub="Show when you've read messages"
              value={readReceipts}
              onChange={saveReadReceipts}
            />
            <Separator />
            <ToggleRow
              icon={<IconBox color="#5856D6" name="ellipsis-horizontal-outline" />}
              label="Typing Indicators"
              sub="Let others see when you're typing"
              value={typingIndicators}
              onChange={saveTyping}
            />
          </Section>
        </View>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <View style={s.group}>
          <SectionLabel label="Notifications" />
          <Section>
            <SettingsRow
              icon={<IconBox color="#FF9500" name="notifications-outline" />}
              label="Push Notifications"
              badge="Soon"
              badgeColor="#FF9500"
              onPress={handleNotificationPlaceholder}
              right={
                <View style={s.rowRight}>
                  <View style={[s.soonBadge, { backgroundColor: "#FF950020" }]}>
                    <Text style={[s.soonText, { color: "#FF9500" }]}>Coming soon</Text>
                  </View>
                </View>
              }
            />
            <Separator />
            <SettingsRow
              icon={<IconBox color="#FF3B30" name="notifications-off-outline" />}
              label="Do Not Disturb"
              badge="Soon"
              badgeColor="#8E8E93"
              onPress={handleNotificationPlaceholder}
              right={
                <View style={[s.soonBadge, { backgroundColor: "#8E8E9320" }]}>
                  <Text style={[s.soonText, { color: "#8E8E93" }]}>Coming soon</Text>
                </View>
              }
            />
          </Section>
        </View>

        {/* ── Storage & Data ────────────────────────────────────────────────── */}
        <View style={s.group}>
          <SectionLabel label="Storage & Data" />
          <Section>
            <SettingsRow
              icon={<IconBox color="#EF4444" name="trash-outline" />}
              label={
                cacheState === "clearing" ? "Clearing…"
                : cacheState === "cleared" ? "Cache cleared ✓"
                : "Clear Cache"
              }
              onPress={handleClearCache}
              disabled={cacheState !== "idle"}
              right={
                cacheState === "clearing" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : cacheState === "cleared" ? (
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                ) : (
                  <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground + "60"} />
                )
              }
            />
            <Separator />
            <SettingsRow
              icon={<IconBox color="#8E8E93" name="information-circle-outline" />}
              label="Version"
              onPress={() => {}}
              right={
                <Text style={[s.valueText, { color: colors.mutedForeground }]}>1.0.0 (SDK 55)</Text>
              }
            />
          </Section>
        </View>

        {/* ── Danger zone ───────────────────────────────────────────────────── */}
        <View style={s.group}>
          <SectionLabel label="Session" />
          <Section>
            <SettingsRow
              icon={<IconBox color="#FF3B30" name="log-out-outline" />}
              label="Sign Out"
              onPress={handleSignOut}
              destructive
              right={<Ionicons name="chevron-forward" size={15} color={"#FF3B3080"} />}
            />
            <Separator />
            <SettingsRow
              icon={<IconBox color="#FF3B30" name="person-remove-outline" />}
              label="Delete Account"
              onPress={handleDeleteAccount}
              destructive
              right={<Ionicons name="chevron-forward" size={15} color={"#FF3B3080"} />}
            />
          </Section>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.mutedForeground }]}>AfuChat Lite · SDK 55</Text>
          <Text style={[s.footerSub, { color: colors.mutedForeground + "80" }]}>
            {user?.email ?? ""}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Inter_600SemiBold" },

  body: { padding: 16, gap: 24 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  profileName: { fontSize: 17, fontFamily: "Inter_700Bold", flexShrink: 1 },
  profileHandle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  profileBio: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  editChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  editChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  group: { gap: 6 },

  rowRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  valueText: { fontSize: 13, fontFamily: "Inter_400Regular", maxWidth: 160 },

  soonBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  soonText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  footer: { alignItems: "center", gap: 4, paddingTop: 8 },
  footerText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  footerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
