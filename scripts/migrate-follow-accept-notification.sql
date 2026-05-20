-- Notable — Fix follow request notifications (Phase 19)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times.
--
-- This migration:
-- 1. Adds 'follow_request_accepted' to the notifications.type check constraint
-- 2. Adds a DELETE policy so client code can remove notifications (follow_request
--    cleanup on accept/decline was failing silently without this)
-- 3. Updates fn_notify_follow to handle UPDATE rows (pending → accepted),
--    so the trigger — not app code — creates the follow_request_accepted
--    notification for the requester
-- 4. Changes the trigger from AFTER INSERT to AFTER INSERT OR UPDATE

-- ── 1. Expand the type constraint ─────────────────────────────────────────────
alter table notifications
  drop constraint if exists notifications_type_check;

alter table notifications
  add constraint notifications_type_check
  check (type in (
    'follow',
    'follow_request',
    'follow_request_accepted',
    'like',
    'bookmark',
    'comment',
    'mention'
  ));

-- ── 2. Allow users to delete their own notifications ─────────────────────────
--
-- The original migration had no DELETE policy, so client-side deletes (e.g.
-- removing a follow_request notification after accepting/declining) silently
-- returned 0 rows.  This caused follow_request notifications to accumulate
-- and created the "duplicate" appearance in the dropdown + notifications page.

create policy if not exists "Users can delete their own notifications"
  on notifications for delete
  using (auth.uid() = user_id);

-- ── 3. Updated trigger function ───────────────────────────────────────────────
--
-- Handles three cases based on TG_OP and status:
--
--   INSERT + status = 'pending'
--     → 'follow_request' notification for the target (they must approve)
--
--   INSERT + status = 'accepted' (or null — public profile immediate follow)
--     → 'follow' notification for the target
--
--   UPDATE from 'pending' → 'accepted'
--     → 'follow_request_accepted' notification for the REQUESTER (follower_id),
--       so they see "[Name] accepted your follow request".
--       actor_id is following_id (the person who accepted).
--
-- App code must NOT manually insert follow or follow_request_accepted
-- notifications — this trigger handles all of them.

create or replace function fn_notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never notify yourself
  if new.follower_id = new.following_id then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if new.status = 'pending' then
      insert into notifications (user_id, type, actor_id, actor_ids)
      values (
        new.following_id,
        'follow_request',
        new.follower_id,
        array[new.follower_id]
      );
    elsif new.status = 'accepted' or new.status is null then
      insert into notifications (user_id, type, actor_id, actor_ids)
      values (
        new.following_id,
        'follow',
        new.follower_id,
        array[new.follower_id]
      );
    end if;

  elsif TG_OP = 'UPDATE' then
    if old.status = 'pending' and new.status = 'accepted' then
      -- Notify the requester that their request was accepted
      insert into notifications (user_id, type, actor_id, actor_ids)
      values (
        new.follower_id,      -- requester receives this
        'follow_request_accepted',
        new.following_id,     -- acceptor is the actor
        array[new.following_id]
      );
    end if;
  end if;

  return new;
end;
$$;

-- ── 4. Re-create trigger to fire on INSERT OR UPDATE ─────────────────────────
drop trigger if exists trg_notify_follow on follows;
create trigger trg_notify_follow
  after insert or update on follows
  for each row execute function fn_notify_follow();
