import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabPill({
  icon,
  iconFocused,
  focused,
  color,
  badge,
}: {
  icon: IoniconsName;
  iconFocused: IoniconsName;
  focused: boolean;
  color: string;
  badge?: number;
}) {
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <View style={{ position: "relative" }}>
        <Ionicons
          name={focused ? iconFocused : icon}
          size={21}
          color={focused ? "#fff" : color}
        />
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pendingCount } = useOffline();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: insets.bottom + 12,
          left: 72,
          right: 72,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          elevation: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          overflow: "hidden",
        },
        tabBarItemStyle: {
          height: 52,
          paddingVertical: 0,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabPill
              icon="chatbubbles-outline"
              iconFocused="chatbubbles"
              focused={focused}
              color={color}
              badge={pendingCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabPill
              icon="albums-outline"
              iconFocused="albums"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabPill
              icon="person-circle-outline"
              iconFocused="person-circle"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 42,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
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
