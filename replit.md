# AfuChat Lite

A lightweight Android-only chat app built on Expo, backed by the AfuChat Supabase project. Supports real-time messaging, offline queuing, user discovery, and auth.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Platform

**Android only.** This is not a cross-platform or hybrid app.
- iOS support has been fully removed and must never be reintroduced.
- There are no `ios` fields in `app.json`, no `Platform.OS === "ios"` checks, and no iOS-specific code anywhere in the codebase.
- All `Platform.OS` ternaries have been collapsed to their Android values.
- All `Platform` imports from `react-native` have been removed.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Mobile: Expo SDK 55, expo-router, Supabase JS client (Android only)

## Where things live

- `artifacts/afuchat-lite/` — Expo mobile app (Android-focused)
  - `app/(auth)/` — login & register screens
  - `app/(tabs)/` — chats, contacts, profile tabs
  - `app/chat/[id].tsx` — individual chat screen
  - `lib/supabase.ts` — Supabase client + TypeScript types
  - `context/AuthContext.tsx` — auth state
  - `context/OfflineContext.tsx` — offline message queue
  - `components/` — Avatar, MessageBubble, ChatListItem, OfflineBanner
  - `hooks/useColors.ts` — color scheme hook

## Architecture decisions

- Uses existing AfuChat Supabase project (`rhnsjqqtdzlkvqazfcbg`, eu-north-1)
- Existing `profiles` table uses `display_name`/`handle`/`bio`/`last_seen` (not `full_name`/`username`)
- Created fresh `conversations`, `conversation_participants`, `chat_messages` tables (NOT the existing `messages` table which has a different schema)
- Offline support: messages queued in AsyncStorage, synced when back online (ping-based detection)
- Real-time via Supabase channels on `chat_messages` and `conversations`
- Dark gradient auth screens, light/dark adaptive chat UI via `useColors` hook

## Product

- Register/login with email + password
- Browse all users by display name or @handle  
- Start 1-on-1 conversations
- Real-time chat with optimistic message delivery
- Offline message queuing (synced when back online)
- Profile view/edit (display_name, bio)
- Online status via `last_seen` field

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Schema mismatch**: existing `messages` table has `chat_id`/`encrypted_content`/`sent_at`. App uses `chat_messages` table instead.
- **Profiles columns**: use `display_name`, `handle`, `bio`, `last_seen` (NOT `full_name`, `username`, `status_text`, `is_online`)
- **@react-native-community/netinfo**: installed 12.0.1 (Expo expects 11.4.1) — app uses custom ping fallback instead of NetInfo
- **Package name**: `com.afuchat.lite`
- **Supabase project**: `rhnsjqqtdzlkvqazfcbg`, region eu-north-1

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
