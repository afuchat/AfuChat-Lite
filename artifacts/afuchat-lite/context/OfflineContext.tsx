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

type PendingMessage = {
  localId: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
};

type OfflineContextType = {
  isOnline: boolean;
  pendingMessages: PendingMessage[];
  queueMessage: (msg: PendingMessage) => Promise<void>;
  syncPending: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextType | null>(null);
const QUEUE_KEY = "offline_message_queue";

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const syncingRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY).then((raw) => {
      if (raw) setPendingMessages(JSON.parse(raw));
    });

    const checkOnline = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const r = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/profiles?limit=1`,
          {
            headers: {
              apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);
        setIsOnline(r.ok || r.status !== 0);
      } catch {
        setIsOnline(false);
      }
    };

    checkOnline();
    const interval = setInterval(checkOnline, 20000);
    return () => clearInterval(interval);
  }, []);

  const saveQueue = async (msgs: PendingMessage[]) => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(msgs));
  };

  const queueMessage = useCallback(async (msg: PendingMessage) => {
    setPendingMessages((prev) => {
      const updated = [...prev, msg];
      saveQueue(updated);
      return updated;
    });
  }, []);

  const syncPending = useCallback(async () => {
    if (syncingRef.current || pendingMessages.length === 0) return;
    syncingRef.current = true;

    const remaining: PendingMessage[] = [];
    for (const msg of pendingMessages) {
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: msg.conversationId,
        sender_id: msg.senderId,
        content: msg.content,
        local_id: msg.localId,
        created_at: msg.createdAt,
      });
      if (error) remaining.push(msg);
    }

    setPendingMessages(remaining);
    await saveQueue(remaining);
    syncingRef.current = false;
  }, [pendingMessages]);

  useEffect(() => {
    if (isOnline && pendingMessages.length > 0) {
      syncPending();
    }
  }, [isOnline, pendingMessages.length, syncPending]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingMessages, queueMessage, syncPending }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
