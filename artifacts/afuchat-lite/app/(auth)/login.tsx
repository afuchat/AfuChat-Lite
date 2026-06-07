import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AfuChatLogo } from "@/components/AfuChatLogo";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type LoginMode = "email" | "username";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, getEmailByHandle, resetPassword } = useAuth();
  const colors = useColors();

  const [mode, setMode] = useState<LoginMode>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idFocused, setIdFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailFocused, setResetEmailFocused] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const resetEmailRef = useRef<TextInput>(null);

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setIdentifier("");
    setForgotOpen(false);
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    let email = identifier.trim().toLowerCase();

    if (mode === "username") {
      const handle = email.replace(/^@/, "");
      const found = await getEmailByHandle(handle);
      if (!found) {
        setLoading(false);
        Alert.alert("User not found", `No account with username @${handle} was found.`);
        return;
      }
      email = found;
    }

    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) Alert.alert("Sign in failed", error);
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert("Required", "Please enter your email address.");
      return;
    }
    setResetLoading(true);
    const { error } = await resetPassword(resetEmail.trim());
    setResetLoading(false);
    if (error) {
      Alert.alert("Failed", error);
    } else {
      setForgotOpen(false);
      setResetEmail("");
      Alert.alert("Email sent", "Check your inbox for a password reset link.");
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={24}
    >
      {/* Brand */}
      <View style={styles.logoWrap}>
        <AfuChatLogo size={72} />
        <Text style={[styles.appName, { color: colors.foreground }]}>AfuChat Lite</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Fast. Simple. Yours.</Text>
      </View>

      {/* Heading */}
      <View style={styles.headingWrap}>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to your account</Text>
      </View>

      {/* Mode toggle */}
      <View style={[styles.toggle, { backgroundColor: colors.muted }]}>
        {(["email", "username"] as LoginMode[]).map((m) => (
          <Pressable
            key={m}
            style={[
              styles.toggleOption,
              mode === m && { backgroundColor: colors.background, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
            ]}
            onPress={() => switchMode(m)}
          >
            <Feather
              name={m === "email" ? "mail" : "at-sign"}
              size={14}
              color={mode === m ? colors.primary : colors.mutedForeground}
            />
            <Text style={[
              styles.toggleLabel,
              { color: mode === m ? colors.primary : colors.mutedForeground },
              mode === m && { fontFamily: "Inter_600SemiBold" },
            ]}>
              {m === "email" ? "Email" : "Username"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Identifier field */}
        <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: idFocused ? colors.primary : colors.border }]}>
          <Feather
            name={mode === "email" ? "mail" : "at-sign"}
            size={18}
            color={idFocused ? colors.primary : colors.mutedForeground}
          />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder={mode === "email" ? "Email address" : "Username"}
            placeholderTextColor={colors.mutedForeground}
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType={mode === "email" ? "email-address" : "default"}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            onFocus={() => setIdFocused(true)}
            onBlur={() => setIdFocused(false)}
          />
        </View>

        {/* Password + forgot link */}
        <View>
          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: passFocused ? colors.primary : colors.border }]}>
            <Feather name="lock" size={18} color={passFocused ? colors.primary : colors.mutedForeground} />
            <TextInput
              ref={passwordRef}
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              onFocus={() => setPassFocused(true)}
              onBlur={() => setPassFocused(false)}
            />
            <Pressable onPress={() => setShowPass(!showPass)} hitSlop={10}>
              <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Pressable
            style={styles.forgotLink}
            onPress={() => { setForgotOpen(!forgotOpen); setResetEmail(""); }}
          >
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              {forgotOpen ? "Cancel" : "Forgot password?"}
            </Text>
          </Pressable>
        </View>

        {/* Inline forgot-password panel */}
        {forgotOpen && (
          <View style={[styles.resetPanel, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.resetTitle, { color: colors.foreground }]}>Reset your password</Text>
            <Text style={[styles.resetSubtitle, { color: colors.mutedForeground }]}>
              Enter your email and we'll send a reset link.
            </Text>
            <View style={[
              styles.inputRow,
              { backgroundColor: colors.background, borderColor: resetEmailFocused ? colors.primary : colors.border, marginTop: 10 },
            ]}>
              <Feather name="mail" size={18} color={resetEmailFocused ? colors.primary : colors.mutedForeground} />
              <TextInput
                ref={resetEmailRef}
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Your email address"
                placeholderTextColor={colors.mutedForeground}
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleResetPassword}
                onFocus={() => setResetEmailFocused(true)}
                onBlur={() => setResetEmailFocused(false)}
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.resetBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={handleResetPassword}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.resetBtnText}>Send Reset Link</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Sign in */}
        <Pressable
          style={({ pressed }) => [styles.signInBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.signInBtnText}>Sign In</Text>
          )}
        </Pressable>
      </View>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>New to AfuChat?</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.createBtn, { borderColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
        onPress={() => router.push("/(auth)/register")}
      >
        <Text style={[styles.createBtnText, { color: colors.primary }]}>Create an Account</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, gap: 24 },

  logoWrap: { alignItems: "center", gap: 8 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", letterSpacing: 0.2 },

  headingWrap: { gap: 4 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },

  toggle: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  toggleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },

  form: { gap: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },

  forgotLink: { alignSelf: "flex-end", marginTop: 6 },
  forgotText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  resetPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 2,
  },
  resetTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  resetSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resetBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  resetBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  signInBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  signInBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: 0.1 },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  createBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  createBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
