import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useOffline } from "@/context/OfflineContext";

export function OfflineBanner() {
  const { isOnline, pendingMessages } = useOffline();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={14} color="#fff" />
      <Text style={styles.text}>
        Offline{pendingMessages.length > 0 ? ` — ${pendingMessages.length} pending` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#475569",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
