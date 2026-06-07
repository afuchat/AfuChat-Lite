import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useOffline } from "@/context/OfflineContext";

export function OfflineBanner() {
  const { isOnline, pendingCount } = useOffline();
  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={13} color="#fff" />
      <Text style={styles.text}>
        Offline{pendingCount > 0 ? ` · ${pendingCount} queued` : ""}
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
    paddingVertical: 5,
  },
  text: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
});
