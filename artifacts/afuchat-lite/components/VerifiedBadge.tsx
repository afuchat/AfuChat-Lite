import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  size?: number;
};

export function VerifiedBadge({ size = 18 }: Props) {
  const iconSize = Math.round(size * 0.6);
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Ionicons name="checkmark" size={iconSize} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "#1E90FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
});
