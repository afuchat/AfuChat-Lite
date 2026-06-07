import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = { name: string };

export function TypingIndicator({ name }: Props) {
  const colors = useColors();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - i * 150),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: colors.theirBubble }]}>
        <Text style={[styles.name, { color: colors.mutedForeground }]}>{name} is typing</Text>
        <View style={styles.dots}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: colors.mutedForeground, opacity: dot },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: 12, marginVertical: 4 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dots: { flexDirection: "row", gap: 3, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
