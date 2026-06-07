import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  display_name: string | null;
  handle: string;
  bio: string | null;
  avatar_url: string | null;
  last_seen: string | null;
  is_verified: boolean;
  is_online?: boolean;
  acoin: number;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type Chat = {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  user_id: string | null;
  description: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_channel: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  who_can_send: string;
  created_at: string;
  updated_at: string;
};

export type ChatMember = {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  is_admin: boolean;
  profile?: Profile;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  encrypted_content: string;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  reply_to_message_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  sender?: Profile;
  replyTo?: Message | null;
  pending?: boolean;
  failed?: boolean;
  local_id?: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  author?: Profile;
};

export function getDisplayName(p: Profile | null | undefined): string {
  if (!p) return "Unknown";
  return p.display_name || `@${p.handle}` || "Unknown";
}

export function isOnline(p: Profile | null | undefined): boolean {
  if (!p?.last_seen) return false;
  return Date.now() - new Date(p.last_seen).getTime() < 5 * 60 * 1000;
}

/** Haversine distance in km between two lat/lng points */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
