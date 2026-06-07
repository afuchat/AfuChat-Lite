import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OfflineProvider } from "@/context/OfflineContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ONBOARDING_DONE_KEY } from "@/app/onboarding";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Re-read AsyncStorage on every segment/session change so a freshly
  // completed onboarding is always reflected — never use stale cached state.
  useEffect(() => {
    if (authLoading) return;

    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((val) => {
      const onboarded = val === "1";
      const inAuth = segments[0] === "(auth)";
      const inOnboarding = segments[0] === "onboarding";
      const inTabs = segments[0] === "(tabs)";
      const inChat = segments[0] === "chat";
      const inProfile = segments[0] === "profile";

      if (!onboarded && !inOnboarding) {
        router.replace("/onboarding");
      } else if (onboarded && !session && !inAuth) {
        router.replace("/(auth)/login");
      } else if (onboarded && session && !inTabs && !inChat && !inProfile) {
        router.replace("/(tabs)/chats");
      }
    });
  }, [session, authLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OfflineProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <AuthGate>
                    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen
                        name="chat/[id]"
                        options={{ headerShown: true, animation: "slide_from_right" }}
                      />
                      <Stack.Screen
                        name="profile/edit"
                        options={{ headerShown: false, animation: "slide_from_right" }}
                      />
                    </Stack>
                  </AuthGate>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </OfflineProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
