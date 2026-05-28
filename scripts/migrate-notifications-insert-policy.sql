-- Notable — Tighten notifications INSERT policy
-- Replaces the overly broad "Users can insert notifications as actor" policy
-- (which left user_id unconstrained) with one that only allows the specific
-- client-side insert: a follow-accepted notification from the accepting user
-- to the person whose follow request was just accepted.
--
-- All other notification inserts are done by security-definer triggers, which
-- bypass RLS entirely — they are unaffected by this change.
--
-- Run once in the Supabase SQL Editor.

-- Drop the old broad policy
drop policy if exists "Users can insert notifications as actor" on notifications;

-- Replace with a narrowly scoped policy for follow-accept notifications only
create policy "Users can insert follow-accept notifications"
  on notifications for insert
  with check (
    -- The inserting user must be the actor
    auth.uid() = actor_id
    -- Only 'follow' notifications may be inserted directly by clients
    and type = 'follow'
    -- The recipient (user_id) must have a real accepted follow relationship
    -- where the recipient is the requester and auth.uid() is the acceptor.
    and exists (
      select 1
      from follows f
      where f.follower_id = notifications.user_id   -- recipient sent the request
        and f.following_id = auth.uid()              -- actor accepted it
        and f.status = 'accepted'
    )
  );
