import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

import { Profile, supabase } from "@/lib/supabase";

type ProfileUpdates = Partial<Pick<Profile, "display_name" | "bio" | "avatar_url" | "handle">>;

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    handle: string,
    displayName: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: ProfileUpdates) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const cached = await AsyncStorage.getItem(`profile:${userId}`);
      if (cached && mounted.current) setProfile(JSON.parse(cached));

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
        .eq("id", userId)
        .single();

      // PGRST116 = row not found — create a default profile row so the app isn't stuck
      if (error?.code === "PGRST116") {
        const handle = `user_${userId.replace(/-/g, "").slice(0, 12)}`;
        await supabase.from("profiles").insert({
          id: userId,
          handle,
          display_name: handle,
          xp: 0,
          acoin: 0,
          is_business_mode: false,
          location_sharing_enabled: false,
        });
        const { data: created } = await supabase
          .from("profiles")
          .select("id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
          .eq("id", userId)
          .single();
        if (created && mounted.current) {
          setProfile(created as Profile);
          await AsyncStorage.setItem(`profile:${userId}`, JSON.stringify(created));
        }
        return;
      }

      if (error) throw error;
      if (data && mounted.current) {
        setProfile(data as Profile);
        await AsyncStorage.setItem(`profile:${userId}`, JSON.stringify(data));
      }
    } catch {
      // Non-fatal — cached value already shown
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Last-seen heartbeat ────────────────────────────────────────────────────
  const pingLastSeen = useCallback(async (uid: string) => {
    try {
      const visibility = await AsyncStorage.getItem("settings:lastSeenVisibility") ?? "everyone";
      if (visibility === "nobody") return;
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", uid);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }

    // Immediate ping on sign-in / re-mount
    pingLastSeen(user.id);

    // Ping every 60 s while active
    heartbeatRef.current = setInterval(() => pingLastSeen(user.id), 60_000);

    // Ping when app comes to foreground
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        pingLastSeen(user.id);
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sub.remove();
    };
  }, [user, pingLastSeen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted.current) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (e: any) {
      return { error: e?.message ?? "Sign in failed" };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    handle: string,
    displayName: string
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (!data.user) return { error: "Sign up failed" };

      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        handle: handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        display_name: displayName.trim(),
        xp: 0,
        acoin: 0,
        is_business_mode: false,
        location_sharing_enabled: false,
      });

      return { error: profileError?.message ?? null };
    } catch (e: any) {
      return { error: e?.message ?? "Sign up failed" };
    }
  };

  const signOut = async () => {
    try {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      await supabase.auth.signOut();
      const keys = await AsyncStorage.getAllKeys();
      const profileKeys = keys.filter((k) => k.startsWith("profile:"));
      if (profileKeys.length > 0) await AsyncStorage.multiRemove(profileKeys);
    } catch {}
  };

  const updateProfile = async (updates: ProfileUpdates) => {
    if (!user) return { error: "Not authenticated" };
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (!error) await fetchProfile(user.id);
      return { error: error?.message ?? null };
    } catch (e: any) {
      return { error: e?.message ?? "Update failed" };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: "afuchat-lite://reset-password" }
      );
      return { error: error?.message ?? null };
    } catch (e: any) {
      return { error: e?.message ?? "Reset failed" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, loading,
        signIn, signUp, signOut, updateProfile, refreshProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
