import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";

type Props = {
  name?: string;
  uri?: string | null;
  size?: number;
  isOnline?: boolean;
  style?: ViewStyle;
  square?: boolean;
};

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColor(name?: string): string {
  const palette = [
    "#1E90FF", "#6366F1", "#8B5CF6", "#EC4899",
    "#F59E0B", "#10B981", "#0EA5E9", "#EF4444",
    "#FF6B6B", "#00BCD4", "#45B7D1", "#96CEB4",
  ];
  if (!name) return palette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function isRecentlyOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export function Avatar({ name, uri, size = 40, isOnline, style, square }: Props) {
  const colors = useColors();
  const initials = getInitials(name);
  const bg = getColor(name);
  const fontSize = size * 0.38;
  const radius = square ? size * 0.2 : size / 2;

  return (
    <View style={[{ position: "relative", width: size, height: size }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: radius, backgroundColor: bg },
          ]}
        >
          <Text style={[styles.initials, { fontSize, color: "#fff" }]}>
            {initials}
          </Text>
        </View>
      )}
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
  fallback: {
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
