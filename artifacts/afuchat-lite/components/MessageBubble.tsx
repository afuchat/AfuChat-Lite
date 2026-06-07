import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { Message, getDisplayName } from "@/lib/supabase";

type Props = {
  message: Message;
  isMine: boolean;
  isGroup?: boolean;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

export function MessageBubble({ message, isMine, isGroup }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubble,
          isMine
            ? [styles.mineBubble, { backgroundColor: colors.myBubble }]
            : [styles.theirBubble, { backgroundColor: colors.theirBubble }],
          message.pending && styles.pendingBubble,
        ]}
      >
        {!isMine && isGroup && message.sender && (
          <Text style={[styles.senderName, { color: colors.primary }]}>
            {getDisplayName(message.sender)}
          </Text>
        )}

        <Text
          style={[
            styles.content,
            { color: isMine ? colors.myBubbleText : colors.theirBubbleText },
          ]}
        >
          {message.encrypted_content}
        </Text>

        <View style={styles.meta}>
          <Text
            style={[
              styles.time,
              { color: isMine ? "rgba(255,255,255,0.65)" : colors.mutedForeground },
            ]}
          >
            {formatTime(message.sent_at)}
          </Text>
          {isMine && (
            <View style={styles.statusIcon}>
              {message.failed ? (
                <Feather name="alert-circle" size={11} color="#EF4444" />
              ) : message.pending ? (
                <Feather name="clock" size={11} color="rgba(255,255,255,0.55)" />
              ) : message.read_at ? (
                <Feather name="check-circle" size={11} color="rgba(255,255,255,0.8)" />
              ) : (
                <Feather name="check" size={11} color="rgba(255,255,255,0.8)" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 2, paddingHorizontal: 12 },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
  },
  mineBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4 },
  pendingBubble: { opacity: 0.65 },
  senderName: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  content: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  time: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statusIcon: { marginLeft: 1 },
});
