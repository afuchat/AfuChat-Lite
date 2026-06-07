import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";

const LAST_SEEN_KEY = "settings:lastSeenVisibility";

type LastSeenOption = "everyone" | "nobody";

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <Text style={[sl.text, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
  );
}
const sl = StyleSheet.create({
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
});

function Card({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}
const card = StyleSheet.create({
  wrap: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});

function Row({
  icon,
  iconColor,
  label,
  value,
  onPress,
  showSeparator,
  colors,
  destructive,
  right,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  onPress: () => void;
  showSeparator?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  destructive?: boolean;
  right?: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={row.container}
          onPress={() => { Haptics.selectionAsync(); onPress(); }}
          onPressIn={onIn}
          onPressOut={onOut}
          activeOpacity={1}
        >
          <View style={[row.icon, { backgroundColor: iconColor + "18" }]}>
            <Ionicons name={icon as any} size={19} color={iconColor} />
          </View>
          <Text
            style={[row.label, { color: destructive ? "#FF3B30" : colors.foreground }]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {right ?? (
            <View style={row.right}>
              {!!value && (
                <Text style={[row.value, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {value}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground + "80"} />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
      {showSeparator && <View style={[row.sep, { backgroundColor: colors.border }]} />}
    </>
  );
}
const row = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, resetPassword } = useAuth();
  const { themeMode, setThemeMode } = useTheme();

  const [lastSeenVisibility, setLastSeenVisibility] = useState<LastSeenOption>("everyone");
  const [cachingCleared, setCachingCleared] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwSending, setPwSending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY).then((v) => {
      if (v === "nobody") setLastSeenVisibility("nobody");
    });
  }, []);

  const saveLastSeen = async (val: LastSeenOption) => {
    setLastSeenVisibility(val);
    await AsyncStorage.setItem(LAST_SEEN_KEY, val);
    Haptics.selectionAsync();
  };

  const handleClearCache = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith("profile:") || k.startsWith("lastRead:"));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
    setCachingCleared(true);
    setTimeout(() => setCachingCleared(false), 3000);
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert("No email", "No email address found on your account.");
      return;
    }
    setPwSending(true);
    const { error } = await resetPassword(user.email);
    setPwSending(false);
    if (error) {
      Alert.alert("Error", error);
    } else {
      setPwSent(true);
      setTimeout(() => setPwSent(false), 5000);
    }
  };

  const handleCopyEmail = () => {
    if (!user?.email) return;
    Haptics.selectionAsync();
    Alert.alert("Your Email", user.email);
  };

  const handleSignOut = () => {
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

  const THEMES: { label: string; value: ThemeMode; icon: string }[] = [
    { label: "Light", value: "light", icon: "sunny-outline" },
    { label: "Dark", value: "dark", icon: "moon-outline" },
    { label: "Auto", value: "system", icon: "contrast-outline" },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── Account ─────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Account" colors={colors} />
          <Card colors={colors}>
            <Row
              icon="mail-outline"
              iconColor="#5AC8FA"
              label="Email"
              value={user?.email ?? "—"}
              onPress={handleCopyEmail}
              showSeparator
              colors={colors}
              right={
                <View style={styles.rowRight}>
                  <Text style={[styles.valueText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {user?.email ?? "—"}
                  </Text>
                  <Ionicons name="copy-outline" size={14} color={colors.mutedForeground + "80"} />
                </View>
              }
            />
            <Row
              icon="at-outline"
              iconColor="#34C759"
              label="Handle"
              value={profile?.handle ? `@${profile.handle}` : "—"}
              onPress={() => router.push("/profile/edit")}
              showSeparator
              colors={colors}
            />
            <Row
              icon="key-outline"
              iconColor="#FF9500"
              label={pwSending ? "Sending…" : pwSent ? "Email sent ✓" : "Change Password"}
              onPress={handleChangePassword}
              colors={colors}
              right={
                <Ionicons
                  name={pwSent ? "checkmark-circle" : "chevron-forward"}
                  size={pwSent ? 18 : 15}
                  color={pwSent ? "#34C759" : colors.mutedForeground + "80"}
                />
              }
            />
          </Card>
        </View>

        {/* ── Appearance ──────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Appearance" colors={colors} />
          <Card colors={colors}>
            <View style={styles.themeRow}>
              <View style={[styles.themeIcon, { backgroundColor: "#8E8E9318" }]}>
                <Ionicons name="color-palette-outline" size={19} color="#8E8E93" />
              </View>
              <Text style={[styles.themeLabel, { color: colors.foreground }]}>Theme</Text>
              <View style={[styles.themeSegment, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {THEMES.map((t) => {
                  const active = themeMode === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      style={[
                        styles.themeOption,
                        active && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => { Haptics.selectionAsync(); setThemeMode(t.value); }}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={14}
                        color={active ? "#fff" : colors.mutedForeground}
                      />
                      <Text style={[styles.themeOptionText, { color: active ? "#fff" : colors.mutedForeground }]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        </View>

        {/* ── Privacy ─────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Privacy" colors={colors} />
          <Card colors={colors}>
            <View style={styles.themeRow}>
              <View style={[styles.themeIcon, { backgroundColor: "#1E90FF18" }]}>
                <Ionicons name="time-outline" size={19} color="#1E90FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.themeLabel, { color: colors.foreground }]}>Last Seen</Text>
                <Text style={[styles.privacySub, { color: colors.mutedForeground }]}>
                  Who can see when you were last active
                </Text>
              </View>
              <View style={[styles.themeSegment, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {(["everyone", "nobody"] as LastSeenOption[]).map((opt) => {
                  const active = lastSeenVisibility === opt;
                  return (
                    <Pressable
                      key={opt}
                      style={[styles.themeOption, active && { backgroundColor: colors.primary }]}
                      onPress={() => saveLastSeen(opt)}
                    >
                      <Text style={[styles.themeOptionText, { color: active ? "#fff" : colors.mutedForeground }]}>
                        {opt === "everyone" ? "Everyone" : "Nobody"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={[styles.privacyNote, { borderTopColor: colors.border, backgroundColor: colors.muted + "60" }]}>
              <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.privacyNoteText, { color: colors.mutedForeground }]}>
                {lastSeenVisibility === "nobody"
                  ? "Your last seen is hidden. Others won't know when you were online."
                  : "Everyone in AfuChat can see your last active time."}
              </Text>
            </View>
          </Card>
        </View>

        {/* ── App ─────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="App" colors={colors} />
          <Card colors={colors}>
            <Row
              icon="trash-outline"
              iconColor="#FF3B30"
              label={cachingCleared ? "Cache cleared ✓" : "Clear Cache"}
              onPress={handleClearCache}
              showSeparator
              colors={colors}
              right={
                <Ionicons
                  name={cachingCleared ? "checkmark-circle" : "chevron-forward"}
                  size={cachingCleared ? 18 : 15}
                  color={cachingCleared ? "#34C759" : colors.mutedForeground + "80"}
                />
              }
            />
            <Row
              icon="information-circle-outline"
              iconColor="#8E8E93"
              label="Version"
              value="1.0.0 (SDK 55)"
              onPress={() => {}}
              colors={colors}
              right={
                <Text style={[styles.valueText, { color: colors.mutedForeground }]}>1.0.0</Text>
              }
            />
          </Card>
        </View>

        {/* ── Session ─────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel label="Session" colors={colors} />
          <Card colors={colors}>
            <Row
              icon="log-out-outline"
              iconColor="#FF3B30"
              label="Sign Out"
              onPress={handleSignOut}
              colors={colors}
              destructive
              right={<Ionicons name="chevron-forward" size={15} color={"#FF3B30" + "80"} />}
            />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Inter_600SemiBold" },
  body: { padding: 16, gap: 16 },
  section: { gap: 6 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  valueText: { fontSize: 13, fontFamily: "Inter_400Regular", maxWidth: 140 },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  themeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  themeLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  themeSegment: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 2,
    gap: 2,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  themeOptionText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  privacySub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  privacyNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
