import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOffline } from "@/context/OfflineContext";
import { useColors } from "@/hooks/useColors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabLabel({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text style={[styles.label, { color, fontFamily: focused ? "Inter_700Bold" : "Inter_600SemiBold" }]}>
      {label}
    </Text>
  );
}

function TabIcon({ name, color, size = 22 }: { name: IoniconsName; color: string; size?: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function ChatsTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { pendingCount } = useOffline();
  return (
    <View style={{ position: "relative" }}>
      <TabIcon name={focused ? "chatbubbles" : "chatbubbles-outline"} color={color} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount > 9 ? "9+" : pendingCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navBottom = insets.bottom + 12;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          bottom: navBottom,
          left: 20,
          right: 20,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          overflow: "hidden",
        },
        tabBarItemStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { display: "none" },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ color, focused }) => <ChatsTabIcon color={color} focused={focused} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Chats" focused={focused} color={color} />,
          tabBarLabelStyle: { display: "flex" },
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "albums" : "albums-outline"} color={color} />
          ),
          tabBarLabel: ({ color, focused }) => <TabLabel label="Feed" focused={focused} color={color} />,
          tabBarLabelStyle: { display: "flex" },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person-circle" : "person-circle-outline"} color={color} />
          ),
          tabBarLabel: ({ color, focused }) => <TabLabel label="Profile" focused={focused} color={color} />,
          tabBarLabelStyle: { display: "flex" },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 10, marginTop: 2 },
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
