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
    label: "Chats",
    icon: "chatbubbles-outline" as IoniconsName,
    iconFocused: "chatbubbles" as IoniconsName,
  },
  {
    name: "feed",
    label: "Videos",
    icon: "play-circle-outline" as IoniconsName,
    iconFocused: "play-circle" as IoniconsName,
  },
  {
    name: "profile",
    label: "Profile",
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
      style={[styles.wrapper, { bottom: insets.bottom + 14 }]}
      pointerEvents="box-none"
    >
      <View style={[styles.pill, { backgroundColor: colors.tabBar, borderColor: colors.border }]}>
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
              <View style={styles.iconArea}>
                <View style={{ position: "relative" }}>
                  <Ionicons
                    name={focused ? tab.iconFocused : tab.icon}
                    size={24}
                    color={focused ? colors.primary : colors.mutedForeground}
                  />
                  {badge > 0 && (
                    <View style={[styles.badge, { borderColor: colors.tabBar }]}>
                      <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: focused ? colors.primary : colors.mutedForeground },
                    focused && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {focused && (
                  <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
                )}
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
      screenOptions={{ headerShown: false }}
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
    width: 280,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "space-evenly",
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 64,
  },
  iconArea: {
    alignItems: "center",
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontFamily: "Inter_600SemiBold",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -9,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: { color: "#fff", fontSize: 7.5, fontFamily: "Inter_700Bold" },
});
