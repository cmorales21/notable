-- Notable — Follow request trigger fix
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
--
-- This migration does two things:
-- 1. Adds 'follow_request' to the notifications.type check constraint
-- 2. Updates fn_notify_follow to emit 'follow_request' for pending follows
--    and 'follow' for accepted follows (the original behavior).
--
-- Safe to run multiple times.

-- ── 1. Expand the type constraint ─────────────────────────────────────────────
--
-- The notifications table was created with an inline check constraint.
-- Postgres auto-names it <table>_<column>_check.  If your instance used a
-- different name, find it with:
--   select constraint_name
--   from information_schema.table_constraints
--   where table_name = 'notifications' and constraint_type = 'CHECK';
-- Then replace the name below.

alter table notifications
  drop constraint if exists notifications_type_check;

alter table notifications
  add constraint notifications_type_check
  check (type in ('follow', 'follow_request', 'like', 'bookmark', 'comment', 'mention'));

-- ── 2. Updated trigger function ───────────────────────────────────────────────
--
-- When a new row is inserted into follows:
--   • status = 'pending'   → the follow is a request; notify with 'follow_request'
--   • status = 'accepted'  → immediate follow; notify with 'follow'
--   • any other value      → skip (safety net)
--
-- Note: this trigger only fires on INSERT, not on UPDATE.
-- Accepting a request (UPDATE status → 'accepted') does NOT re-fire this
-- function.  The application layer is responsible for sending the "accepted"
-- notification to the requester at that point.

create or replace function fn_notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  -- Never notify yourself
  if new.follower_id = new.following_id then
    return new;
  end if;

  -- Determine notification type from follow status
  if new.status = 'pending' then
    v_type := 'follow_request';
  elsif new.status = 'accepted' or new.status is null then
    v_type := 'follow';
  else
    -- Unknown status — skip
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids)
  values (
    new.following_id,        -- profile owner receives the notification
    v_type,
    new.follower_id,
    array[new.follower_id]
  );

  return new;
end;
$$;

-- Recreate the trigger (drop + create is idempotent)
drop trigger if exists trg_notify_follow on follows;
create trigger trg_notify_follow
  after insert on follows
  for each row execute function fn_notify_follow();
