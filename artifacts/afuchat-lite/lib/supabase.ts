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

// ─── Original DB types — DO NOT alter column names ───────────────────────────

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
};

/** chats table — original AfuChat schema */
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

/** chat_members table — original AfuChat schema */
export type ChatMember = {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  is_admin: boolean;
  profile?: Profile;
};

/** messages table — original AfuChat schema.
 *  Lite stores plaintext in encrypted_content (no E2E in Lite). */
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
  // client-only flags (never persisted)
  pending?: boolean;
  failed?: boolean;
  local_id?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getDisplayName(p: Profile | null | undefined): string {
  if (!p) return "Unknown";
  return p.display_name || `@${p.handle}` || "Unknown";
}

export function isOnline(p: Profile | null | undefined): boolean {
  if (!p?.last_seen) return false;
  return Date.now() - new Date(p.last_seen).getTime() < 5 * 60 * 1000;
}
