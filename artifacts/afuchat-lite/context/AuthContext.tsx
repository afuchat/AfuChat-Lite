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
  getEmailByHandle: (handle: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

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
        .select("id, email, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin, created_at")
        .eq("id", userId)
        .single();

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
        email: email.trim().toLowerCase(),
        handle: handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        display_name: displayName.trim(),
      });

      return { error: profileError?.message ?? null };
    } catch (e: any) {
      return { error: e?.message ?? "Sign up failed" };
    }
  };

  const signOut = async () => {
    try {
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

  const getEmailByHandle = async (handle: string): Promise<string | null> => {
    try {
      const clean = handle.replace(/^@/, "").trim().toLowerCase();
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("handle", clean)
        .maybeSingle();
      if (error || !data?.email) return null;
      return data.email as string;
    } catch {
      return null;
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
        getEmailByHandle, resetPassword,
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
