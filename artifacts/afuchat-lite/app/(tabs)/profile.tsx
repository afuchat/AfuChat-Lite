import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";
import { getDisplayName, isOnline as profileIsOnline } from "@/lib/supabase";

type RowProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  iconColor?: string;
  textColor?: string;
};

function InfoRow({ icon, label, value, iconColor, textColor }: RowProps) {
  const colors = useColors();
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[rowStyles.iconBg, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={16} color={iconColor ?? colors.primary} />
      </View>
      <View style={rowStyles.rowContent}>
        <Text style={[rowStyles.rowLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        {value ? (
          <Text
            style={[rowStyles.rowValue, { color: textColor ?? colors.foreground }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.6 },
  rowValue: { fontSize: 15, fontFamily: "Inter_400Regular" },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, signOut, updateProfile, user } = useAuth();
  const { isOnline: netOnline, pendingCount } = useOffline();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile]);

  const saveProfile = async () => {
    if (mounted.current) setSaving(true);
    try {
      const { error } = await updateProfile({
        display_name: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      if (error) {
        Alert.alert("Could not save", error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (mounted.current) setEditing(false);
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

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

  const name = getDisplayName(profile);
  const isCurrentlyOnline = netOnline && profileIsOnline(profile);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <OfflineBanner />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top gradient header */}
        <View
          style={[
            styles.headerBanner,
            { paddingTop: Platform.OS === "android" ? insets.top + 12 : insets.top + 4 },
          ]}
        >
          <View style={styles.bannerTitleRow}>
            <Text style={styles.bannerTitle}>My Profile</Text>
            <Pressable
              style={styles.editToggleBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setEditing((v) => !v);
              }}
              hitSlop={8}
            >
              <Feather name={editing ? "x" : "edit-2"} size={17} color="#fff" />
            </Pressable>
          </View>

          {/* Avatar */}
          <View style={styles.avatarArea}>
            <View style={styles.avatarRing}>
              <Avatar name={name} size={88} isOnline={isCurrentlyOnline} />
            </View>
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{name}</Text>
                {profile?.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <Feather name="check" size={11} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.profileHandle}>@{profile?.handle}</Text>
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Edit / Bio card */}
          {editing ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
                Edit Profile
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Display Name
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your display name"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={60}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Bio</Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    styles.fieldInputMulti,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted },
                  ]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell people a little about yourself"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={150}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                  {bio.length}/150
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.75 : 1 }]}
                onPress={saveProfile}
                disabled={saving}
                activeOpacity={0.88}
              >
                <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
              </TouchableOpacity>
            </View>
          ) : profile?.bio ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>About</Text>
              <Text style={[styles.bioText, { color: colors.foreground }]}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* Stats row */}
          {(profile?.acoin ?? 0) > 0 && (
            <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#F59E0B" }]}>
                  {profile!.acoin.toLocaleString()}
                </Text>
                <View style={styles.statLabelRow}>
                  <Feather name="zap" size={12} color="#F59E0B" />
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ACoins</Text>
                </View>
              </View>
            </View>
          )}

          {/* Account info */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
              Account
            </Text>
            <InfoRow
              icon="mail"
              label="Email"
              value={user?.email ?? "—"}
            />
            <InfoRow
              icon={netOnline ? "wifi" : "wifi-off"}
              label="Connection"
              value={
                netOnline
                  ? "Online"
                  : `Offline${pendingCount > 0 ? ` · ${pendingCount} queued` : ""}`
              }
              iconColor={netOnline ? colors.online : colors.mutedForeground}
              textColor={netOnline ? colors.online : colors.destructive}
            />
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: colors.destructive }]}
            onPress={confirmSignOut}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>
              Sign Out
            </Text>
          </TouchableOpacity>

          <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
            AfuChat Lite • v1.0.0
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBanner: {
    backgroundColor: "#1E90FF",
    paddingHorizontal: 20,
    paddingBottom: 70,
  },
  bannerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 20,
  },
  bannerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  editToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarArea: { alignItems: "center", gap: 12 },
  avatarRing: {
    padding: 3,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.25)",
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
  profileHandle: { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },

  body: { marginTop: -44, paddingHorizontal: 16, gap: 14 },

  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  bioText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },

  statsRow: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  statItem: { alignItems: "center", gap: 4 },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  fieldInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  fieldInputMulti: { minHeight: 80, paddingTop: 12 },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 15,
  },
  signOutText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  versionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingBottom: 8,
  },
});
