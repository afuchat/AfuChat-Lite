---
name: AfuChat Lite DB schema
description: Correct Supabase table names and key columns for AfuChat Lite; what NOT to create.
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
- **posts** — author column is **`author_id`** NOT `user_id`. Full cols include: `id, author_id, content, created_at, updated_at, image_url, view_count, like_count, comment_count, share_count, repost_count, post_type, visibility, is_blocked`
- **post_likes** — `id, post_id, user_id, created_at` — uses `user_id` (NOT `author_id`)
- **post_replies** — the COMMENTS table. Cols: `id, post_id, author_id, content, created_at, parent_reply_id, is_pinned, voice_url, image_url`

## CRITICAL naming inconsistency
- `posts.author_id` — who wrote the post
- `post_replies.author_id` — who wrote the reply
- `post_likes.user_id` — who liked (uses `user_id`, not `author_id`)
- Do NOT mix these up — querying posts by `user_id` returns nothing / wrong results

## Tables that do NOT exist
- `post_comments`, `comments`, `replies`, `feed_comments`, `likes`, `post_reactions`

## Tables we created (avoid using / can be cleaned up)
- `conversations`, `conversation_participants`, `chat_messages` — created early in project, NOT used by current app

## RLS
All original tables already have RLS policies — no new policies needed.

**Why:** Other apps share the same Supabase backend. Using the original tables keeps data consistent across all AfuChat clients. Custom tables fragment the data.

**How to apply:** Always query `chats`, `chat_members`, `messages`. When querying profiles use `display_name`, `handle`, `bio`. Store message text in `encrypted_content`. For posts use `author_id`. For post comments use `post_replies` with `author_id`. For likes use `post_likes` with `user_id`.
