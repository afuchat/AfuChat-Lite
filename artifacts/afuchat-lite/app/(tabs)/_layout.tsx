import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";

export const FLOATING_NAV_BOTTOM_PADDING = 80;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function NavIcon({
  name,
  color,
  size = 22,
}: {
  name: IoniconsName;
  color: string;
  size?: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function ChatsNavIcon({ color, focused }: { color: string; focused: boolean }) {
  const { pendingCount } = useOffline();
  return (
    <View style={{ position: "relative" }}>
      <NavIcon
        name={focused ? "chatbubbles" : "chatbubbles-outline"}
        color={color}
      />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {pendingCount > 9 ? "9+" : pendingCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomOffset =
    12 + (Platform.OS === "android" ? 0 : Math.max(insets.bottom - 4, 0));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          bottom: bottomOffset,
          left: 44,
          right: 44,
          height: 54,
          borderRadius: 27,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          elevation: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.14,
          shadowRadius: 20,
        },
        tabBarItemStyle: {
          height: 54,
          paddingVertical: 0,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <ChatsNavIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <NavIcon
              name={focused ? "people" : "people-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <NavIcon
              name={focused ? "person-circle" : "person-circle-outline"}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -3,
    right: -5,
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
