import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { ChatMessage } from "@/lib/supabase";

type Props = {
  message: ChatMessage;
  isMine: boolean;
  showSenderName?: boolean;
  senderName?: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${ampm}`;
}

export function MessageBubble({ message, isMine, showSenderName, senderName }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubble,
          isMine
            ? [styles.mineBubble, { backgroundColor: colors.myBubble }]
            : [styles.theirBubble, { backgroundColor: colors.theirBubble }],
          message.pending && { opacity: 0.7 },
        ]}
      >
        {!isMine && showSenderName && senderName && (
          <Text style={[styles.senderName, { color: colors.primary }]}>
            {senderName}
          </Text>
        )}
        <Text
          style={[
            styles.content,
            { color: isMine ? colors.myBubbleText : colors.theirBubbleText },
          ]}
        >
          {message.content}
        </Text>
        <View style={styles.meta}>
          <Text
            style={[
              styles.time,
              { color: isMine ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
            ]}
          >
            {formatTime(message.created_at)}
          </Text>
          {isMine && (
            <View style={styles.statusIcon}>
              {message.failed ? (
                <Feather name="alert-circle" size={11} color="#EF4444" />
              ) : message.pending ? (
                <Feather name="clock" size={11} color="rgba(255,255,255,0.6)" />
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
  senderName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  content: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  time: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statusIcon: { marginLeft: 2 },
});
