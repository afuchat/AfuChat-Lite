import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useColors } from "@/hooks/useColors";
import { getDisplayName, supabase } from "@/lib/supabase";

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldCard({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[fc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[fc.label, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}
const fc = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
});

function HandleStatus({
  status,
  colors,
}: {
  status: "idle" | "checking" | "available" | "taken" | "invalid";
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  if (status === "idle") return null;
  if (status === "checking")
    return <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginLeft: 6 }} />;
  const map = {
    available: { icon: "checkmark-circle" as const, color: "#34C759", label: "Available" },
    taken: { icon: "close-circle" as const, color: "#FF3B30", label: "Already taken" },
    invalid: { icon: "warning" as const, color: "#FF9F0A", label: "Letters, numbers & _ only (min 3)" },
  };
  const cfg = map[status as keyof typeof map];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 6 }}>
      <Ionicons name={cfg.icon} size={15} color={cfg.color} />
      <Text style={{ fontSize: 11, color: cfg.color, fontFamily: "Inter_500Medium" }}>{cfg.label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile, updateProfile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const handleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Handle availability check
  useEffect(() => {
    if (handleTimer.current) clearTimeout(handleTimer.current);
    const raw = handle.trim();
    if (!raw || raw === profile?.handle) { setHandleStatus("idle"); return; }
    const clean = raw.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    if (raw !== raw.replace(/[^a-zA-Z0-9_]/g, "") || clean.length < 3) {
      setHandleStatus("invalid");
      return;
    }
    setHandleStatus("checking");
    handleTimer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("handle", clean)
          .neq("id", user?.id ?? "")
          .maybeSingle();
        if (mounted.current) setHandleStatus(data ? "taken" : "available");
      } catch {
        if (mounted.current) setHandleStatus("idle");
      }
    }, 600);
    return () => { if (handleTimer.current) clearTimeout(handleTimer.current); };
  }, [handle, profile?.handle, user?.id]);

  const pickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo access to upload a profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
        const fileName = `${user!.id}/avatar_${Date.now()}.${ext}`;
        const contentType = ext === "png" ? "image/png" : "image/jpeg";

        const response = await fetch(asset.uri);
        const blob = await response.blob();

        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(fileName, blob, { contentType, upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", user!.id);

        if (updateErr) throw updateErr;

        if (mounted.current) {
          setAvatarUri(publicUrl);
          await refreshProfile();
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: any) {
        Alert.alert("Upload failed", e?.message ?? "Could not upload photo. Try again.");
      } finally {
        if (mounted.current) setUploadingAvatar(false);
      }
    } catch (e: any) {
      if (mounted.current) setUploadingAvatar(false);
      Alert.alert("Error", e?.message ?? "Could not open photo library.");
    }
  };

  const save = async () => {
    const rawHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (rawHandle && rawHandle.length < 3) {
      Alert.alert("Invalid handle", "Handle must be at least 3 characters.");
      return;
    }
    if (handleStatus === "taken") {
      Alert.alert("Handle taken", "Please choose a different handle.");
      return;
    }

    if (mounted.current) setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (displayName.trim()) updates.display_name = displayName.trim();
      if (bio.trim() !== (profile?.bio ?? "")) updates.bio = bio.trim();
      if (rawHandle && rawHandle !== profile?.handle) updates.handle = rawHandle;

      const { error } = await updateProfile(updates as any);
      if (error) {
        Alert.alert("Save failed", error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const currentAvatarUri = avatarUri ?? profile?.avatar_url;
  const name = displayName || getDisplayName(profile);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "android" ? insets.top + 12 : insets.top + 4,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={save}
          disabled={saving || handleStatus === "taken" || handleStatus === "invalid"}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar upload */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickAvatar} style={styles.avatarWrap} disabled={uploadingAvatar}>
            {currentAvatarUri ? (
              <Image
                source={{ uri: currentAvatarUri }}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Avatar name={name} size={100} />
            )}
            <View style={[styles.cameraBtn, { backgroundColor: colors.primary }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={18} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
            Tap to change photo
          </Text>
        </View>

        {/* Display Name */}
        <FieldCard title="Display Name" colors={colors}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor={colors.mutedForeground}
            maxLength={60}
            returnKeyType="next"
          />
        </FieldCard>

        {/* Handle */}
        <FieldCard title="Username / Handle" colors={colors}>
          <View style={styles.handleRow}>
            <Text style={[styles.atSign, { color: colors.mutedForeground }]}>@</Text>
            <TextInput
              style={[styles.handleInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
              value={handle}
              onChangeText={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="your_handle"
              placeholderTextColor={colors.mutedForeground}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <HandleStatus status={handleStatus} colors={colors} />
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Letters, numbers and underscores only. Min 3 characters.
          </Text>
        </FieldCard>

        {/* Bio */}
        <FieldCard title="Bio" colors={colors}>
          <TextInput
            style={[styles.input, styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people a little about yourself…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
            {bio.length}/200
          </Text>
        </FieldCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  scroll: { paddingHorizontal: 16, paddingTop: 24, gap: 16 },

  avatarSection: { alignItems: "center", gap: 10, marginBottom: 8 },
  avatarWrap: { position: "relative" },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { fontSize: 13, fontFamily: "Inter_400Regular" },

  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  bioInput: { minHeight: 90, paddingTop: 12 },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },

  handleRow: { flexDirection: "row", alignItems: "center" },
  atSign: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginRight: 4 },
  handleInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
