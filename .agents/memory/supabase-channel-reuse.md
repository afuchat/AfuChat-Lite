---
name: Supabase realtime channel reuse
description: Why Supabase throws "cannot add postgres_changes after subscribe()" and how to prevent it.
---

## Rule
Always use a unique channel name per `useEffect` subscription. Never reuse a fixed string like `"chats-list-rt"` across effect re-runs.

**Why:** Supabase's `channel()` method returns the **same cached instance** if the name is already registered. When a `useEffect` re-runs (e.g. because a `useCallback` dependency changed reference), `removeChannel` is async — the old channel isn't fully torn down before the next run. The new `channel("same-name")` call returns the still-subscribed old instance, and adding `.on("postgres_changes", ...)` to an already-subscribed channel throws the error.

**How to apply:** Use a `useRef(0)` counter in the component and append it to the channel name on each effect run:
```typescript
const rtChannelSeq = useRef(0);
// inside useEffect:
const chName = `chats-list-rt-${rtChannelSeq.current++}`;
const ch = supabase.channel(chName).on(...).subscribe();
return () => { supabase.removeChannel(ch); };
```
This applies to any Supabase realtime channel inside a `useEffect` that may re-run (i.e. has non-empty deps).

**Note on React Compiler:** Adding a bare `useEffect(() => { ref.current = val; })` with no deps array conflicts with the React Compiler (`reactCompiler: true` in app.json) and produces "Invalid hook call" errors. Prefer the unique-name approach over the ref-sync pattern in this project.
