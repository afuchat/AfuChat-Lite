import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
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

import { Avatar, isRecentlyOnline } from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";
import { getDisplayName } from "@/lib/supabase";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, signOut, updateProfile, user } = useAuth();
  const { isOnline, pendingMessages } = useOffline();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile]);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      display_name: displayName.trim(),
      bio: bio.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert("Error", error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    }
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

  const online = isRecentlyOnline(profile?.last_seen);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* Header banner */}
        <View
          style={[
            styles.headerBg,
            { paddingTop: insets.top + 12, backgroundColor: colors.primary },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Pressable
              onPress={() => {
                setEditing(!editing);
                Haptics.selectionAsync();
              }}
              style={styles.editBtn}
            >
              <Feather name={editing ? "x" : "edit-2"} size={18} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.avatarWrap}>
            <Avatar
              name={getDisplayName(profile)}
              size={88}
              isOnline={isOnline && online}
            />
          </View>
        </View>

        <View style={styles.body}>
          {editing ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Display Name
              </Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your display name"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.mutedForeground, marginTop: 12 },
                ]}
              >
                Bio
              </Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  { color: colors.foreground, borderColor: colors.border },
                ]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people about yourself"
                placeholderTextColor={colors.mutedForeground}
                maxLength={150}
                multiline
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={saveProfile}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.nameRow}>
                <Text style={[styles.displayName, { color: colors.foreground }]}>
                  {getDisplayName(profile)}
                </Text>
                {profile?.is_verified && (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                )}
              </View>
              <Text style={[styles.handle, { color: colors.primary }]}>
                @{profile?.handle}
              </Text>
              {profile?.bio ? (
                <Text style={[styles.bioText, { color: colors.mutedForeground }]}>
                  {profile.bio}
                </Text>
              ) : null}
              {profile?.acoin !== undefined && (
                <View style={[styles.coinRow, { borderTopColor: colors.border }]}>
                  <Feather name="zap" size={14} color="#F59E0B" />
                  <Text style={[styles.coinText, { color: colors.foreground }]}>
                    {profile.acoin.toLocaleString()} ACoins
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Account Info */}
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              ACCOUNT
            </Text>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {user?.email}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Feather
                name={isOnline ? "wifi" : "wifi-off"}
                size={16}
                color={isOnline ? colors.online : colors.mutedForeground}
              />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {isOnline
                  ? "Online"
                  : `Offline${pendingMessages.length > 0 ? ` — ${pendingMessages.length} pending` : ""}`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: colors.destructive }]}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBg: { paddingBottom: 60, paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: { alignItems: "center" },
  body: { paddingHorizontal: 16, gap: 16, marginTop: -32 },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  displayName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  handle: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  bioText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 20,
  },
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
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  section: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoText: { fontSize: 15, fontFamily: "Inter_400Regular" },
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
