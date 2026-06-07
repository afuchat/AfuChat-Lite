import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  name: string;
  size?: number;
  isOnline?: boolean;
  style?: object;
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getColor(name: string): string {
  const palette = [
    "#1E90FF", "#6366F1", "#8B5CF6", "#EC4899",
    "#F59E0B", "#10B981", "#0EA5E9", "#EF4444",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function isRecentlyOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff < 5 * 60 * 1000; // within 5 minutes
}

export function Avatar({ name, size = 40, isOnline, style }: Props) {
  const colors = useColors();
  const initials = getInitials(name || "?");
  const bg = getColor(name || "?");
  const fontSize = size * 0.38;

  return (
    <View style={[{ position: "relative" }, style]}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize, color: "#fff" }]}>
          {initials}
        </Text>
      </View>
      {isOnline !== undefined && (
        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: isOnline ? colors.online : colors.offline,
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              right: 0,
              bottom: 0,
              borderColor: colors.background,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: "Inter_600SemiBold",
  },
  onlineDot: {
    position: "absolute",
    borderWidth: 2,
  },
});
