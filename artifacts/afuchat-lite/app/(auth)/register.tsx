import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AfuChatLogo } from "@/components/AfuChatLogo";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const STEPS = ["Profile", "Account"];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();
  const colors = useColors();

  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const animateToStep = (next: number) => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      slideAnim.setValue(0);
    });
  };

  const goNext = () => {
    if (!displayName.trim()) {
      Alert.alert("Required", "Please enter your display name.");
      return;
    }
    if (handle.trim().length < 3) {
      Alert.alert("Invalid handle", "Username must be at least 3 characters.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateToStep(1);
  };

  const goBack = () => {
    if (step === 0) router.back();
    else animateToStep(0);
  };

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", "Please make sure both passwords are the same.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const { error } = await signUp(email.trim(), password, handle, displayName);
    setLoading(false);
    if (error) {
      Alert.alert("Registration failed", error);
    } else {
      Alert.alert(
        "Account created!",
        "Welcome to AfuChat Lite! Check your email to confirm your account.",
        [{ text: "Sign In", onPress: () => router.replace("/(auth)/login") }]
      );
    }
  };

  const progress = (step + 1) / STEPS.length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.logoWrap}>
            <AfuChatLogo size={52} />
            <Text style={[styles.appName, { color: colors.foreground }]}>AfuChat Lite</Text>
          </View>

          {/* Header row */}
          <View style={styles.header}>
            <Pressable onPress={goBack} hitSlop={12}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
            <View style={styles.stepInfo}>
              <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
                Step {step + 1} of {STEPS.length}
              </Text>
              <Text style={[styles.stepName, { color: colors.foreground }]}>{STEPS[step]}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <Animated.View
              style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]}
            />
          </View>

          {/* Step content — flat, no card */}
          <Animated.View
            style={{
              opacity: slideAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 1] }),
              transform: [{
                translateX: slideAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -20, 0] }),
              }],
            }}
          >
            {step === 0 ? (
              <Step1
                displayName={displayName}
                handle={handle}
                setDisplayName={setDisplayName}
                setHandle={setHandle}
                handleRef={handleRef}
                onNext={goNext}
                colors={colors}
              />
            ) : (
              <Step2
                email={email}
                password={password}
                confirmPassword={confirmPassword}
                showPass={showPass}
                showConfirm={showConfirm}
                setEmail={setEmail}
                setPassword={setPassword}
                setConfirmPassword={setConfirmPassword}
                setShowPass={setShowPass}
                setShowConfirm={setShowConfirm}
                emailRef={emailRef}
                passwordRef={passwordRef}
                confirmRef={confirmRef}
                loading={loading}
                onSubmit={handleRegister}
                colors={colors}
              />
            )}
          </Animated.View>

          {/* Footer link */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ displayName, handle, setDisplayName, setHandle, handleRef, onNext, colors }: {
  displayName: string; handle: string;
  setDisplayName: (v: string) => void; setHandle: (v: string) => void;
  handleRef: React.RefObject<TextInput | null>;
  onNext: () => void; colors: any;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={[styles.title, { color: colors.foreground }]}>Your Identity</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Choose how people will see you on AfuChat Lite.
      </Text>
      <View style={styles.form}>
        <InputField
          icon="user"
          placeholder="Display name (e.g. Alex Smith)"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => handleRef.current?.focus()}
          colors={colors}
        />
        <View>
          <InputField
            ref={handleRef}
            icon="at-sign"
            placeholder="Username (e.g. alex_smith)"
            value={handle}
            onChangeText={(t: string) => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onNext}
            colors={colors}
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Only letters, numbers, and underscores. Min 3 characters.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
          onPress={onNext}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({
  email, password, confirmPassword, showPass, showConfirm,
  setEmail, setPassword, setConfirmPassword, setShowPass, setShowConfirm,
  emailRef, passwordRef, confirmRef, loading, onSubmit, colors,
}: {
  email: string; password: string; confirmPassword: string;
  showPass: boolean; showConfirm: boolean;
  setEmail: (v: string) => void; setPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void; setShowPass: (v: boolean) => void;
  setShowConfirm: (v: boolean) => void;
  emailRef: React.RefObject<TextInput | null>;
  passwordRef: React.RefObject<TextInput | null>;
  confirmRef: React.RefObject<TextInput | null>;
  loading: boolean; onSubmit: () => void; colors: any;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={[styles.title, { color: colors.foreground }]}>Your Account</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Set up your email and a secure password.
      </Text>
      <View style={styles.form}>
        <InputField ref={emailRef} icon="mail" placeholder="Email address" value={email}
          onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
          autoCorrect={false} returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()} colors={colors} />
        <InputField ref={passwordRef} icon="lock" placeholder="Password (min 6 chars)" value={password}
          onChangeText={setPassword} secureTextEntry={!showPass} returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          rightIcon={showPass ? "eye-off" : "eye"} onRightIconPress={() => setShowPass(!showPass)} colors={colors} />
        <InputField ref={confirmRef} icon="shield" placeholder="Confirm password" value={confirmPassword}
          onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} returnKeyType="done"
          onSubmitEditing={onSubmit}
          rightIcon={showConfirm ? "eye-off" : "eye"} onRightIconPress={() => setShowConfirm(!showConfirm)} colors={colors} />
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed || loading ? 0.88 : 1 }]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>Create Account</Text>
              <Feather name="check" size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Reusable input ───────────────────────────────────────────────────────────

type InputFieldProps = {
  icon: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
  colors: any;
  [key: string]: any;
};

const InputField = React.forwardRef<TextInput, InputFieldProps>(
  ({ icon, rightIcon, onRightIconPress, colors, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <View style={[
        styles.inputRow,
        {
          backgroundColor: colors.muted,
          borderColor: focused ? colors.primary : colors.border,
        },
      ]}>
        <Feather name={icon} size={18} color={focused ? colors.primary : colors.mutedForeground} />
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.foreground }]}
          placeholderTextColor={colors.mutedForeground}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} hitSlop={10}>
            <Feather name={rightIcon} size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, gap: 24 },

  logoWrap: { alignItems: "center", gap: 6 },
  appName: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },

  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepInfo: { gap: 2 },
  stepLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stepName: { fontSize: 18, fontFamily: "Inter_700Bold" },

  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },

  stepContent: { gap: 6 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 4 },

  form: { gap: 12, marginTop: 4 },
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
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, marginLeft: 2 },

  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  footerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
