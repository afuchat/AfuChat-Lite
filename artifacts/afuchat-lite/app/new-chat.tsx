import { Feather, Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  Profile,
  getDisplayName,
  haversineKm,
  isOnline,
  supabase,
} from "@/lib/supabase";

type Tab = "search" | "nearby" | "contacts";

type NearbyProfile = Profile & { distanceKm: number };
type DeviceContact = {
  id: string;
  name: string;
  phone?: string;
  appUser?: Profile;
};

export default function NewChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("search");
  const [search, setSearch] = useState("");
  const [appUsers, setAppUsers] = useState<Profile[]>([]);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyProfile[]>([]);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ── Search app users ─────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (q: string) => {
    if (!user) return;
    if (mounted.current) setLoading(true);
    try {
      let query = supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
        .neq("id", user.id)
        .limit(50);

      if (q.trim()) {
        query = query.or(`handle.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query;
      if (mounted.current) setAppUsers((data as Profile[]) ?? []);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (tab === "search") fetchUsers(""); }, [tab, fetchUsers]);
  useEffect(() => {
    const t = setTimeout(() => { if (tab === "search") fetchUsers(search); }, 300);
    return () => clearTimeout(t);
  }, [search, tab, fetchUsers]);

  // ── Nearby users ─────────────────────────────────────────────────────────
  const loadNearby = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location required", "Please allow location access to find nearby users.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: myLat, longitude: myLon } = loc.coords;

      // Update our own profile location
      await supabase
        .from("profiles")
        .update({ latitude: myLat, longitude: myLon })
        .eq("id", user.id);

      // Bounding box for ~100km
      const degLat = 100 / 111;
      const degLon = 100 / (111 * Math.cos((myLat * Math.PI) / 180));

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at, latitude, longitude")
        .neq("id", user.id)
        .gte("latitude", myLat - degLat)
        .lte("latitude", myLat + degLat)
        .gte("longitude", myLon - degLon)
        .lte("longitude", myLon + degLon)
        .limit(100);

      if (error) {
        if (error.message?.includes("column") && error.message?.includes("does not exist")) {
          Alert.alert(
            "Setup needed",
            "Run this SQL in your Supabase dashboard:\n\nALTER TABLE profiles ADD COLUMN latitude FLOAT;\nALTER TABLE profiles ADD COLUMN longitude FLOAT;"
          );
          setLoading(false);
          return;
        }
        throw error;
      }

      const nearby = ((data ?? []) as Profile[])
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          ...p,
          distanceKm: haversineKm(myLat, myLon, p.latitude!, p.longitude!),
        }))
        .filter((p) => p.distanceKm <= 100)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (mounted.current) setNearbyUsers(nearby);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not find nearby users.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (tab === "nearby") loadNearby(); }, [tab]);

  // ── Device contacts ──────────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Contacts access", "Please allow access to your contacts.");
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      const contacts: DeviceContact[] = data
        .filter((c) => c.name)
        .map((c) => ({
          id: c.id ?? c.name,
          name: c.name,
          phone: c.phoneNumbers?.[0]?.number,
        }));

      if (mounted.current) setDeviceContacts(contacts);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load contacts.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === "contacts") loadContacts(); }, [tab]);

  // ── Start a chat ─────────────────────────────────────────────────────────
  const openChat = async (other: Profile) => {
    if (!user || starting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarting(other.id);
    try {
      const { data: mine } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", user.id);

      const myIds = (mine ?? []).map((r) => r.chat_id);

      if (myIds.length) {
        const { data: shared } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", other.id)
          .in("chat_id", myIds);

        if (shared?.length) {
          const { data: existing } = await supabase
            .from("chats")
            .select("id")
            .eq("id", shared[0].chat_id)
            .eq("is_group", false)
            .single();

          if (existing) {
            router.replace({
              pathname: "/chat/[id]",
              params: { id: existing.id, name: getDisplayName(other), isGroup: "0", avatarUrl: other.avatar_url ?? "", otherId: other.id },
            });
            return;
          }
        }
      }

      const { data: newChat, error: chatErr } = await supabase
        .from("chats")
        .insert({ is_group: false, created_by: user.id, user_id: other.id })
        .select()
        .single();

      if (chatErr) throw chatErr;

      await supabase.from("chat_members").insert([
        { chat_id: newChat.id, user_id: user.id },
        { chat_id: newChat.id, user_id: other.id },
      ]);

      router.replace({
        pathname: "/chat/[id]",
        params: { id: newChat.id, name: getDisplayName(other), isGroup: "0", avatarUrl: other.avatar_url ?? "", otherId: other.id },
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not open chat.");
    } finally {
      if (mounted.current) setStarting(null);
    }
  };

  const renderUser = (item: Profile, extra?: string) => {
    const name = getDisplayName(item);
    const online = isOnline(item);
    const busy = starting === item.id;
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.border }]}
        onPress={() => openChat(item)}
        disabled={!!starting}
        activeOpacity={0.7}
      >
        <Avatar uri={item.avatar_url} name={name} size={46} isOnline={online} />
        <View style={styles.rowInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
            {item.is_verified && <VerifiedBadge size={16} />}
          </View>
          <Text style={[styles.rowSub, { color: colors.primary }]}>@{item.handle}</Text>
          {extra ? <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{extra}</Text> : null}
        </View>
        {busy ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <View style={[styles.chatChip, { backgroundColor: colors.secondary }]}>
            <Feather name="message-circle" size={16} color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-down" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Chat</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["search", "nearby", "contacts"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabItem, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => {
              Haptics.selectionAsync();
              setTab(t);
              setSearch("");
            }}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? colors.primary : colors.mutedForeground,
                  fontFamily: tab === t ? "Inter_700Bold" : "Inter_500Medium" },
              ]}
            >
              {t === "search" ? "Search" : t === "nearby" ? "Nearby" : "Contacts"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search input (only on search tab) */}
      {tab === "search" && (
        <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Name or @handle…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            {tab === "nearby" ? "Finding nearby users…" : tab === "contacts" ? "Loading contacts…" : "Searching…"}
          </Text>
        </View>
      ) : tab === "search" ? (
        <FlatList
          data={appUsers}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => renderUser(item)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                {search ? `No results for "${search}"` : "No users found"}
              </Text>
            </View>
          }
        />
      ) : tab === "nearby" ? (
        <FlatList
          data={nearbyUsers}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => renderUser(item, `${item.distanceKm.toFixed(1)} km away`)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="map-pin" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>No one nearby</Text>
              <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                No AfuChat users within 100 km
              </Text>
              <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadNearby}>
                <Text style={styles.retryText}>Refresh</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <FlatList
          data={deviceContacts}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) =>
            item.appUser ? (
              renderUser(item.appUser, item.phone)
            ) : (
              <View style={[styles.row, { borderBottomColor: colors.border }]}>
                <View style={[styles.initials, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.initialsText, { color: colors.mutedForeground }]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.phone ? (
                    <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{item.phone}</Text>
                  ) : null}
                </View>
                <View style={[styles.inviteChip, { borderColor: colors.primary }]}>
                  <Text style={[styles.inviteText, { color: colors.primary }]}>Invite</Text>
                </View>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.stateText, { color: colors.mutedForeground }]}>No contacts found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabText: { fontSize: 14 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  stateText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  initials: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  rowInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  rowName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  rowSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  chatChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  inviteText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
