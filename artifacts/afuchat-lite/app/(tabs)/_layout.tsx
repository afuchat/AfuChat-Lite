import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useUnread } from "@/context/UnreadContext";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TABS = [
  {
    name: "chats",
    icon: "chatbubbles-outline" as IoniconsName,
    iconFocused: "chatbubbles" as IoniconsName,
  },
  {
    name: "feed",
    icon: "albums-outline" as IoniconsName,
    iconFocused: "albums" as IoniconsName,
  },
  {
    name: "profile",
    icon: "person-circle-outline" as IoniconsName,
    iconFocused: "person-circle" as IoniconsName,
  },
];

function CustomTabBar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { totalUnread } = useUnread();

  const activeIndex = TABS.findIndex((t) => pathname.startsWith(`/${t.name}`));

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + 12 }]}
      pointerEvents="box-none"
    >
      <View style={[styles.pill, { backgroundColor: colors.tabBar }]}>
        {TABS.map((tab, index) => {
          const focused = activeIndex === index;
          const badge = tab.name === "chats" && totalUnread > 0 ? totalUnread : 0;

          return (
            <Pressable
              key={tab.name}
              onPress={() => router.replace(`/(tabs)/${tab.name}` as any)}
              style={styles.tabBtn}
              hitSlop={4}
            >
              <View style={[styles.iconPill, focused && styles.iconPillActive]}>
                <View style={{ position: "relative" }}>
                  <Ionicons
                    name={focused ? tab.iconFocused : tab.icon}
                    size={21}
                    color={focused ? "#fff" : colors.mutedForeground}
                  />
                  {badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  } as any,
  pill: {
    flexDirection: "row",
    width: 168,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "space-evenly",
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 52,
  },
  iconPill: {
    width: 42,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillActive: {
    backgroundColor: "#1E90FF",
    shadowColor: "#1E90FF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -7,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 7, fontWeight: "700" },
});
