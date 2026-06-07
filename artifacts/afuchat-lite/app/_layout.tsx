import "react-native-url-polyfill/auto";
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
import { StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AfuChatLogo } from "@/components/AfuChatLogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OfflineProvider } from "@/context/OfflineContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UnreadProvider } from "@/context/UnreadContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";
    const inChat = segments[0] === "chat";
    const inProfile = segments[0] === "profile";
    const inNewChat = segments[0] === "new-chat";

    if (!session && !inAuth) {
      router.replace("/(auth)/login");
    } else if (session && !inTabs && !inChat && !inProfile && !inNewChat) {
      router.replace("/(tabs)/chats");
    }
  }, [session, authLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    const bg = colorScheme === "dark" ? "#06090F" : "#FFFFFF";
    return (
      <View style={[styles.splash, { backgroundColor: bg }]}>
        <AfuChatLogo size={80} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <UnreadProvider>
                <OfflineProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <KeyboardProvider>
                      <AuthGate>
                        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                          <Stack.Screen name="index" />
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
                          <Stack.Screen
                            name="profile/[id]"
                            options={{ headerShown: false, animation: "slide_from_right" }}
                          />
                          <Stack.Screen
                            name="new-chat"
                            options={{ headerShown: false, animation: "slide_from_bottom" }}
                          />
                        </Stack>
                      </AuthGate>
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </OfflineProvider>
              </UnreadProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
