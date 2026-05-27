-- Notable — Respect notify_followers preference in follow notification trigger
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times (CREATE OR REPLACE + ADD COLUMN IF NOT EXISTS).
--
-- Prerequisite: migrate-notification-prefs.sql should have been run first to
-- add notify_followers to profiles. This migration also adds the column with
-- ADD COLUMN IF NOT EXISTS as a safety net, so it is safe to run standalone.
--
-- What changes:
--   The existing fn_notify_follow trigger previously inserted follow and
--   follow_request notifications unconditionally. This update makes it check
--   the recipient's notify_followers preference first.
--
--   Behaviour by case:
--     INSERT + pending   → 'follow_request' notification to following_id
--                          ONLY if their notify_followers is true (or null/missing)
--     INSERT + accepted  → 'follow' notification to following_id
--                          ONLY if their notify_followers is true (or null/missing)
--     UPDATE pending→accepted → 'follow_request_accepted' notification to follower_id
--                          ALWAYS — the requester asked to follow, so they should
--                          always be told whether it was accepted.
--
--   If notify_followers is NULL on the profile row, or the profile row is not
--   found, we default to true (send the notification).

-- ── 1. Ensure notify_followers column exists ──────────────────────────────────
--
-- Idempotent — does nothing if the column already exists.
-- DEFAULT true matches the application default so existing users are unaffected.

alter table profiles
  add column if not exists notify_followers boolean default true;

-- ── 2. Replace trigger function ───────────────────────────────────────────────

create or replace function fn_notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notify_followers boolean;
begin
  -- Never notify yourself
  if new.follower_id = new.following_id then
    return new;
  end if;

  if TG_OP = 'INSERT' then

    -- Fetch the recipient's preference.
    -- COALESCE handles a stored NULL (treats as true).
    -- The outer IS NULL guard handles the case where the profile row is missing.
    select coalesce(notify_followers, true)
      into v_notify_followers
      from profiles
     where id = new.following_id;

    if v_notify_followers is null then
      v_notify_followers := true;
    end if;

    if v_notify_followers then
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
    end if;

  elsif TG_OP = 'UPDATE' then

    if old.status = 'pending' and new.status = 'accepted' then
      -- The requester explicitly asked to follow this person, so they should
      -- always learn whether the request was accepted — no preference check here.
      insert into notifications (user_id, type, actor_id, actor_ids)
      values (
        new.follower_id,       -- requester receives this
        'follow_request_accepted',
        new.following_id,      -- acceptor is the actor
        array[new.following_id]
      );
    end if;

  end if;

  return new;
end;
$$;

-- ── 3. Re-create trigger (idempotent drop + create) ───────────────────────────

drop trigger if exists trg_notify_follow on follows;

create trigger trg_notify_follow
  after insert or update on follows
  for each row execute function fn_notify_follow();
