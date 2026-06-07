import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();

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
    <LinearGradient colors={["#06090F", "#0A1A36", "#06090F"]} style={styles.gradient}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>AfuChat Lite</Text>
            <Text style={styles.tagline}>Fast. Simple. Yours.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            <View style={styles.form}>
              {/* Email */}
              <View style={[styles.inputRow, emailFocused && styles.inputRowFocused]}>
                <Feather name="mail" size={18} color={emailFocused ? "#1E90FF" : "#5C7A99"} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#5C7A99"
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

              {/* Password */}
              <View style={[styles.inputRow, passFocused && styles.inputRowFocused]}>
                <Feather name="lock" size={18} color={passFocused ? "#1E90FF" : "#5C7A99"} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#5C7A99"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
                <Pressable onPress={() => setShowPass(!showPass)} hitSlop={10}>
                  <Feather
                    name={showPass ? "eye-off" : "eye"}
                    size={18}
                    color="#5C7A99"
                  />
                </Pressable>
              </View>

              {/* Sign In button */}
              <Pressable
                style={({ pressed }) => [styles.signInBtn, { opacity: pressed ? 0.88 : 1 }]}
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
              <View style={styles.divider} />
              <Text style={styles.dividerText}>New to AfuChat?</Text>
              <View style={styles.divider} />
            </View>

            {/* Create account */}
            <Pressable
              style={({ pressed }) => [styles.createBtn, { opacity: pressed ? 0.88 : 1 }]}
              onPress={() => router.push("/(auth)/register")}
            >
              <Text style={styles.createBtnText}>Create an Account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, gap: 36 },

  logoWrap: { alignItems: "center", gap: 12 },
  iconShadowWrap: {
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  logo: { width: 84, height: 84, borderRadius: 22 },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.2,
  },

  card: {
    backgroundColor: "#0D1526",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#172035",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#EDF2FB",
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#5C7A99",
    marginBottom: 6,
  },

  form: { gap: 12, marginTop: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111C30",
    borderWidth: 1.5,
    borderColor: "#172035",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  inputRowFocused: {
    borderColor: "#1E90FF",
    backgroundColor: "#0E2040",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#EDF2FB",
  },
  signInBtn: {
    backgroundColor: "#1E90FF",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  signInBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  divider: { flex: 1, height: 1, backgroundColor: "#172035" },
  dividerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#5C7A99",
  },

  createBtn: {
    borderWidth: 1.5,
    borderColor: "#1E90FF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  createBtnText: {
    color: "#1E90FF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
