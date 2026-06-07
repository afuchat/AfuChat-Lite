---
name: AfuChat Lite DB schema
description: Real column names in the existing AfuChat Supabase project and which tables the Lite app uses
---

## Supabase project
- Project ref: `rhnsjqqtdzlkvqazfcbg`, region: eu-north-1
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## profiles (existing, do NOT recreate)
- `id`, `display_name`, `handle`, `bio`, `avatar_url`, `last_seen`, `is_verified`, `acoin`, `created_at`
- NOT `full_name`, `username`, `status_text`, `is_online`

## chat_messages (created by us)
- `id`, `conversation_id`, `sender_id`, `content`, `is_read`, `local_id`, `created_at`
- Do NOT use the existing `messages` table — it has `chat_id`/`encrypted_content`/`sent_at`

## conversations + conversation_participants (created by us)
- Both created fresh with correct schema

**Why:** The existing AfuChat project has a rich schema (100+ tables) for the main app. Many tables pre-existed with different column names. We created our own tables prefixed/named carefully to avoid conflicts.

**How to apply:** When querying profiles always use `display_name`, `handle`, `bio`. When querying messages use `chat_messages` table. Never touch the existing `messages` table.
