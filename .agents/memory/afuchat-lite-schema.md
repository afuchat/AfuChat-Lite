---
name: AfuChat Lite DB schema
description: Correct original Supabase table names and key columns for AfuChat Lite; what NOT to create.
---

## Supabase project
- Project ref: `rhnsjqqtdzlkvqazfcbg`, region: eu-north-1
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Tables in use (ORIGINAL — do not create substitutes)
- **chats** — `id, name, is_group, created_by, user_id, is_channel, is_archived, is_pinned, who_can_send, updated_at`
- **chat_members** — `id, chat_id, user_id, joined_at, is_admin`
- **messages** — `id, chat_id, sender_id, encrypted_content, sent_at, reply_to_message_id, attachment_url, attachment_type`
  - Lite stores plaintext in `encrypted_content` (no E2E in Lite)
- **profiles** — `id, display_name, handle, bio, avatar_url, last_seen, is_verified, acoin`
  - NOT full_name, username, status_text, is_online
- **typing_indicators** — `id, chat_id, user_id, is_typing, started_at`

## Tables we created (avoid using / can be cleaned up)
- `conversations`, `conversation_participants`, `chat_messages` — created early in project, NOT used by current app

## RLS
All original tables already have RLS policies — no new policies needed.

**Why:** Other apps share the same Supabase backend. Using the original tables keeps data consistent across all AfuChat clients. Custom tables fragment the data.

**How to apply:** Always query `chats`, `chat_members`, `messages`. When querying profiles use `display_name`, `handle`, `bio`. Store message text in `encrypted_content`. Never touch custom tables created earlier.
