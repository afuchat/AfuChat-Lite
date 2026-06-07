import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabItem({
  icon,
  iconFocused,
  label,
  focused,
  color,
  badge,
}: {
  icon: IoniconsName;
  iconFocused: IoniconsName;
  label: string;
  focused: boolean;
  color: string;
  badge?: number;
}) {
  return (
    <View
      style={[
        styles.tabItem,
        focused && { backgroundColor: color + "20" },
      ]}
    >
      <View style={{ position: "relative" }}>
        <Ionicons name={focused ? iconFocused : icon} size={22} color={color} />
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.label,
          {
            color,
            fontFamily: focused ? "Inter_700Bold" : "Inter_500Medium",
          },
        ]}
      >
        {label}
      </Text>
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
          bottom: insets.bottom + 14,
          left: 48,
          right: 48,
          height: 68,
          borderRadius: 34,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 24,
          overflow: "hidden",
        },
        tabBarItemStyle: {
          height: 68,
          paddingVertical: 0,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabItem
              icon="chatbubbles-outline"
              iconFocused="chatbubbles"
              label="Chats"
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
            <TabItem
              icon="albums-outline"
              iconFocused="albums"
              label="Feed"
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
            <TabItem
              icon="person-circle-outline"
              iconFocused="person-circle"
              label="Profile"
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
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    minWidth: 64,
  },
  label: {
    fontSize: 11,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },
});
