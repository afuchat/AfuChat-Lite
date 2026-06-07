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

export type PendingMessage = {
  localId: string;
  chatId: string;
  senderId: string;
  content: string;
  replyToId: string | null;
  sentAt: string;
};

type OfflineContextType = {
  isOnline: boolean;
  pendingCount: number;
  queueMessage: (msg: PendingMessage) => Promise<void>;
  syncPending: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextType | null>(null);
const QUEUE_KEY = "afuchat_lite_offline_queue_v2";

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const syncing = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY).then((raw) => {
      if (raw && mounted.current) setPending(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  // Probe connectivity via Supabase — avoids CORS / network policy issues
  // that plague external fetch probes on Android.
  useEffect(() => {
    const probe = async () => {
      try {
        const { error } = await supabase
          .from("profiles")
          .select("id")
          .limit(1);

        if (!mounted.current) return;

        if (!error) {
          setIsOnline(true);
          return;
        }

        // Any DB/auth error still means the network is reachable
        const msg = (error.message ?? "").toLowerCase();
        const networkDown =
          msg.includes("failed to fetch") ||
          msg.includes("network request failed") ||
          msg.includes("fetch failed") ||
          msg.includes("networkerror");

        setIsOnline(!networkDown);
      } catch (e: any) {
        if (!mounted.current) return;
        const msg = (e?.message ?? "").toLowerCase();
        setIsOnline(
          !msg.includes("failed to fetch") &&
          !msg.includes("network request failed") &&
          !msg.includes("fetch failed")
        );
      }
    };

    const initial = setTimeout(probe, 800);
    const interval = setInterval(probe, 15_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  const saveQueue = async (msgs: PendingMessage[]) => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(msgs));
  };

  const queueMessage = useCallback(async (msg: PendingMessage) => {
    setPending((prev) => {
      const updated = [...prev, msg];
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
            reply_to_message_id: msg.replyToId ?? null,
            sent_at: msg.sentAt,
          });
          if (!error) {
            await supabase
              .from("chats")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", msg.chatId);
          } else {
            remaining.push(msg);
          }
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

  useEffect(() => {
    if (isOnline && pending.length > 0) syncPending();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OfflineContext.Provider
      value={{ isOnline, pendingCount: pending.length, queueMessage, syncPending }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
