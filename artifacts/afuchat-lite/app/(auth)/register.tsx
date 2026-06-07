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

  // Step 1
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  // Step 2
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
    if (step === 0) {
      router.back();
    } else {
      animateToStep(0);
    }
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
        "Account created! 🎉",
        "Welcome to AfuChat Lite! Check your email to confirm your account.",
        [{ text: "Sign In", onPress: () => router.replace("/(auth)/login") }]
      );
    }
  };

  const progress = (step + 1) / STEPS.length;

  return (
    <View style={[styles.gradient, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="height"
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
            <View style={styles.stepInfo}>
              <Text style={styles.stepLabel}>
                Step {step + 1} of {STEPS.length}
              </Text>
              <Text style={styles.stepName}>{STEPS[step]}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>

          {/* Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: slideAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0, 1],
                }),
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, -30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {step === 0 ? (
              <Step1
                displayName={displayName}
                handle={handle}
                setDisplayName={setDisplayName}
                setHandle={setHandle}
                handleRef={handleRef}
                onNext={goNext}
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
              />
            )}
          </Animated.View>

          {/* Sign in link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({
  displayName, handle, setDisplayName, setHandle, handleRef, onNext,
}: {
  displayName: string;
  handle: string;
  setDisplayName: (v: string) => void;
  setHandle: (v: string) => void;
  handleRef: React.RefObject<TextInput | null>;
  onNext: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.cardTitle}>Your Identity</Text>
      <Text style={styles.cardSubtitle}>
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
        />
        <View>
          <InputField
            ref={handleRef}
            icon="at-sign"
            placeholder="Username (e.g. alex_smith)"
            value={handle}
            onChangeText={(t: string) =>
              setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onNext}
          />
          <Text style={styles.hint}>
            Only letters, numbers, and underscores. Min 3 characters.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.88 : 1 }]}
          onPress={onNext}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({
  email, password, confirmPassword, showPass, showConfirm,
  setEmail, setPassword, setConfirmPassword, setShowPass, setShowConfirm,
  emailRef, passwordRef, confirmRef, loading, onSubmit,
}: {
  email: string; password: string; confirmPassword: string;
  showPass: boolean; showConfirm: boolean;
  setEmail: (v: string) => void; setPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void; setShowPass: (v: boolean) => void;
  setShowConfirm: (v: boolean) => void;
  emailRef: React.RefObject<TextInput | null>;
  passwordRef: React.RefObject<TextInput | null>;
  confirmRef: React.RefObject<TextInput | null>;
  loading: boolean; onSubmit: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.cardTitle}>Your Account</Text>
      <Text style={styles.cardSubtitle}>
        Set up your email and a secure password.
      </Text>

      <View style={styles.form}>
        <InputField
          ref={emailRef}
          icon="mail"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <InputField
          ref={passwordRef}
          icon="lock"
          placeholder="Password (min 6 chars)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          rightIcon={showPass ? "eye-off" : "eye"}
          onRightIconPress={() => setShowPass(!showPass)}
        />
        <InputField
          ref={confirmRef}
          icon="shield"
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirm}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          rightIcon={showConfirm ? "eye-off" : "eye"}
          onRightIconPress={() => setShowConfirm(!showConfirm)}
        />

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed || loading ? 0.88 : 1 }]}
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
  [key: string]: any;
};

const InputField = React.forwardRef<TextInput, InputFieldProps>(
  ({ icon, rightIcon, onRightIconPress, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Feather name={icon} size={18} color={focused ? "#1E90FF" : "#5C7A99"} />
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor="#5C7A99"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} hitSlop={10}>
            <Feather name={rightIcon} size={18} color="#5C7A99" />
          </Pressable>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, gap: 20 },

  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepInfo: { gap: 2 },
  stepLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#5C7A99" },
  stepName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#EDF2FB" },

  progressTrack: {
    height: 4,
    backgroundColor: "#172035",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#1E90FF",
    borderRadius: 2,
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
  },
  stepContent: { gap: 6 },
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
    marginBottom: 8,
    lineHeight: 20,
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
  inputRowFocused: { borderColor: "#1E90FF", backgroundColor: "#0E2040" },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#EDF2FB",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#5C7A99",
    marginTop: 4,
    marginLeft: 4,
  },

  primaryBtn: {
    backgroundColor: "#1E90FF",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#5C7A99" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1E90FF" },
});
