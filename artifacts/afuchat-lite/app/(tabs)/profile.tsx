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
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";
import { getDisplayName, isOnline } from "@/lib/supabase";

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

  const profileName = getDisplayName(profile);
  const profileOnline = netOnline && isOnline(profile);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Blue header banner */}
        <View style={[styles.banner, { paddingTop: insets.top + 12, backgroundColor: colors.primary }]}>
          <View style={styles.bannerRow}>
            <Text style={styles.bannerTitle}>Profile</Text>
            <Pressable
              style={styles.editBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setEditing((v) => !v);
              }}
              hitSlop={8}
            >
              <Feather name={editing ? "x" : "edit-2"} size={18} color="#fff" />
            </Pressable>
          </View>
          <Avatar name={profileName} size={90} isOnline={profileOnline} style={styles.avatar} />
        </View>

        <View style={styles.body}>
          {/* Info / Edit card */}
          {editing ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Display Name</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your display name"
                placeholderTextColor={colors.mutedForeground}
                maxLength={60}
                returnKeyType="next"
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Bio</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people about yourself"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={150}
                returnKeyType="done"
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                onPress={saveProfile}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.nameRow}>
                <Text style={[styles.displayName, { color: colors.foreground }]}>{profileName}</Text>
                {profile?.is_verified && (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                )}
              </View>
              <Text style={[styles.handle, { color: colors.primary }]}>@{profile?.handle}</Text>
              {profile?.bio ? (
                <Text style={[styles.bioText, { color: colors.mutedForeground }]}>{profile.bio}</Text>
              ) : (
                <Text style={[styles.bioText, { color: colors.mutedForeground }]}>No bio yet</Text>
              )}
              {(profile?.acoin ?? 0) > 0 && (
                <View style={[styles.coinRow, { borderTopColor: colors.border }]}>
                  <Feather name="zap" size={14} color="#F59E0B" />
                  <Text style={[styles.coinText, { color: colors.foreground }]}>
                    {profile!.acoin.toLocaleString()} ACoins
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Account section */}
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.rowIcon} />
              <Text style={[styles.infoText, { color: colors.foreground }]} numberOfLines={1}>
                {user?.email ?? "—"}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Feather
                name={netOnline ? "wifi" : "wifi-off"}
                size={16}
                color={netOnline ? colors.online : colors.mutedForeground}
                style={styles.rowIcon}
              />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {netOnline
                  ? "Online"
                  : `Offline${pendingCount > 0 ? ` · ${pendingCount} message${pendingCount > 1 ? "s" : ""} queued` : ""}`}
              </Text>
            </View>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: colors.destructive }]}
            onPress={confirmSignOut}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { paddingHorizontal: 20, paddingBottom: 64 },
  bannerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  bannerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.3 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { alignSelf: "center" },
  body: { paddingHorizontal: 16, gap: 14, marginTop: -36 },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 4,
  },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  displayName: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3, textAlign: "center" },
  handle: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  bioText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginTop: 4 },
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  coinText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  fieldInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: "top" },
  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 18 },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  section: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    textTransform: "uppercase",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { marginRight: 12 },
  infoText: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  signOutText: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
