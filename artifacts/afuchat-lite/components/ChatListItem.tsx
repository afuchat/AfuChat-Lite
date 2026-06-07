import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { Chat, Profile, getDisplayName, isOnline } from "@/lib/supabase";

type Props = {
  chat: Chat;
  otherUser: Profile | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  onPress: () => void;
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
  }
  if (diff < 604_800_000) return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatListItem({ chat, otherUser, lastMessage, lastMessageAt, onPress }: Props) {
  const colors = useColors();
  const title = chat.is_group ? (chat.name ?? "Group") : getDisplayName(otherUser);
  const online = !chat.is_group && isOnline(otherUser);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.background }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar name={title} size={52} isOnline={online} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          {lastMessageAt && (
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {formatTime(lastMessageAt)}
            </Text>
          )}
        </View>
        <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={1}>
          {lastMessage ?? "Tap to start chatting"}
        </Text>
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
  content: { flex: 1, gap: 3 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  preview: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
