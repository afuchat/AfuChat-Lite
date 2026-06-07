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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) Alert.alert("Sign in failed", error);
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

      {/* Form */}
      <View style={styles.form}>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: colors.muted, borderColor: emailFocused ? colors.primary : colors.border },
          ]}
        >
          <Feather name="mail" size={18} color={emailFocused ? colors.primary : colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Email address"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
        </View>

        <View
          style={[
            styles.inputRow,
            { backgroundColor: colors.muted, borderColor: passFocused ? colors.primary : colors.border },
          ]}
        >
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
          style={({ pressed }) => [
            styles.signInBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
          ]}
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
        style={({ pressed }) => [
          styles.createBtn,
          { borderColor: colors.primary, opacity: pressed ? 0.88 : 1 },
        ]}
        onPress={() => router.push("/(auth)/register")}
      >
        <Text style={[styles.createBtnText, { color: colors.primary }]}>Create an Account</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, gap: 28 },

  logoWrap: { alignItems: "center", gap: 8 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", letterSpacing: 0.2 },

  headingWrap: { gap: 4 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },

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

  signInBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  signInBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  createBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  createBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
