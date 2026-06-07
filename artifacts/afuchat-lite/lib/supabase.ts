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

// Real profiles table uses display_name, handle, bio, last_seen
export type Profile = {
  id: string;
  display_name: string | null;
  handle: string;
  bio: string | null;
  avatar_url: string | null;
  last_seen: string | null;
  is_verified: boolean;
  acoin: number;
  created_at: string;
};

export type Conversation = {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  local_id?: string;
  created_at: string;
  sender?: Profile;
  pending?: boolean;
  failed?: boolean;
};

// Helper to get display name from profile
export function getDisplayName(profile: Profile | null | undefined): string {
  if (!profile) return "Unknown";
  return profile.display_name || `@${profile.handle}` || "Unknown";
}
