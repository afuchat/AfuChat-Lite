import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { Conversation } from "@/lib/supabase";

type Props = {
  conversation: Conversation;
  otherUserName: string;
  unreadCount?: number;
  onPress: () => void;
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${m} ${ampm}`;
  }
  if (diff < 604800000) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatListItem({ conversation, otherUserName, unreadCount = 0, onPress }: Props) {
  const colors = useColors();
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.background }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar
        name={conversation.name || otherUserName}
        size={52}
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[
              styles.name,
              {
                color: colors.foreground,
                fontFamily: hasUnread ? "Inter_600SemiBold" : "Inter_500Medium",
              },
            ]}
            numberOfLines={1}
          >
            {conversation.name || otherUserName}
          </Text>
          <Text
            style={[
              styles.time,
              {
                color: hasUnread ? colors.primary : colors.mutedForeground,
                fontFamily: hasUnread ? "Inter_500Medium" : "Inter_400Regular",
              },
            ]}
          >
            {formatTime(conversation.last_message_at)}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.preview,
              {
                color: hasUnread ? colors.foreground : colors.mutedForeground,
                fontFamily: hasUnread ? "Inter_500Medium" : "Inter_400Regular",
                flex: 1,
              },
            ]}
            numberOfLines={1}
          >
            {conversation.last_message ?? "Start a conversation"}
          </Text>
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preview: {
    fontSize: 14,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
