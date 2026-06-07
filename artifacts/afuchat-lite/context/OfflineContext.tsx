import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

/** Pending message stored locally while offline.
 *  Stores plaintext in encrypted_content per AfuChat Lite convention. */
export type PendingMessage = {
  localId: string;
  chatId: string;
  senderId: string;
  content: string;
  sentAt: string;
};

type OfflineContextType = {
  isOnline: boolean;
  pendingCount: number;
  queueMessage: (msg: PendingMessage) => Promise<void>;
  syncPending: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextType | null>(null);
const QUEUE_KEY = "afuchat_lite_offline_queue_v1";

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const syncing = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Load queue from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY).then((raw) => {
      if (raw && mounted.current) setPending(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  // Simple connectivity probe every 20 s
  useEffect(() => {
    const probe = async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (mounted.current) setIsOnline(res.ok);
      } catch {
        if (mounted.current) setIsOnline(false);
      }
    };
    probe();
    const id = setInterval(probe, 20_000);
    return () => clearInterval(id);
  }, []);

  const saveQueue = async (msgs: PendingMessage[]) => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(msgs));
  };

  const queueMessage = useCallback(async (msg: PendingMessage) => {
    const next = (prev: PendingMessage[]) => [...prev, msg];
    setPending((prev) => {
      const updated = next(prev);
      saveQueue(updated).catch(() => {});
      return updated;
    });
  }, []);

  const syncPending = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const queue = [...pending];
      const remaining: PendingMessage[] = [];

      for (const msg of queue) {
        try {
          const { error } = await supabase.from("messages").insert({
            chat_id: msg.chatId,
            sender_id: msg.senderId,
            encrypted_content: msg.content,
            sent_at: msg.sentAt,
          });
          if (error) remaining.push(msg);
        } catch {
          remaining.push(msg);
        }
      }

      if (mounted.current) setPending(remaining);
      await saveQueue(remaining);
    } finally {
      syncing.current = false;
    }
  }, [pending]);

  // Sync when we come back online
  useEffect(() => {
    if (isOnline && pending.length > 0) syncPending();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount: pending.length, queueMessage, syncPending }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
