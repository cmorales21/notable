-- Notable — Wire notification preferences for likes, follows and comments
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — ALTER TABLE uses IF NOT EXISTS, functions use
-- CREATE OR REPLACE.
--
-- fn_notify_bookmark is NOT touched — it already checks notify_bookmarks.

-- ── 1. Add missing preference columns ────────────────────────────────────────
--
-- notify_likes, notify_followers, notify_comments may already exist if
-- migrate-settings.sql was applied first; IF NOT EXISTS makes this idempotent.

alter table profiles
  add column if not exists notify_likes      boolean not null default true,
  add column if not exists notify_followers  boolean not null default true,
  add column if not exists notify_comments   boolean not null default true;

-- ── 2. fn_notify_like — check notify_likes before inserting ──────────────────

create or replace function fn_notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner        uuid;
  v_notify_likes boolean;
begin
  -- Look up whose recommendation was liked
  select user_id into v_owner
  from recommendations
  where id = new.recommendation_id;

  -- Skip if the recommendation was deleted or it's the owner liking their own post
  if v_owner is null or new.user_id = v_owner then
    return new;
  end if;

  -- Respect the owner's preference; default to true if column is somehow null
  select coalesce(notify_likes, true)
  into v_notify_likes
  from profiles
  where id = v_owner;

  if not v_notify_likes then
    return new;
  end if;

  -- Try to aggregate into an existing unread like notification for this rec
  update notifications
  set
    actor_id   = new.user_id,
    -- Avoid duplicates (in case someone likes, unlikes, relikes)
    actor_ids  = case
      when new.user_id = any(actor_ids) then actor_ids
      else array_append(actor_ids, new.user_id)
    end,
    read       = false,     -- re-marks unread so the dot reappears
    updated_at = now()
  where user_id = v_owner
    and type    = 'like'
    and rec_id  = new.recommendation_id
    and read    = false;    -- only aggregate into unread ones

  -- If no unread notification existed, create a new one
  if not found then
    insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
    values (v_owner, 'like', new.user_id, array[new.user_id], new.recommendation_id);
  end if;

  return new;
end;
$$;

-- ── 3. fn_notify_follow — check notify_followers before inserting ─────────────

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

  -- Respect the followed user's preference; default to true if column is somehow null
  select coalesce(notify_followers, true)
  into v_notify_followers
  from profiles
  where id = new.following_id;

  if not v_notify_followers then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids)
  values (
    new.following_id,        -- the person being followed gets the notification
    'follow',
    new.follower_id,         -- the person who followed
    array[new.follower_id]
  );

  return new;
end;
$$;

-- ── 4. fn_notify_comment — check notify_comments before inserting ─────────────

create or replace function fn_notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner           uuid;
  v_notify_comments boolean;
begin
  select user_id into v_owner
  from recommendations
  where id = new.recommendation_id;

  if v_owner is null or new.user_id = v_owner then
    return new;
  end if;

  -- Respect the owner's preference; default to true if column is somehow null
  select coalesce(notify_comments, true)
  into v_notify_comments
  from profiles
  where id = v_owner;

  if not v_notify_comments then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
  values (v_owner, 'comment', new.user_id, array[new.user_id], new.recommendation_id);

  return new;
end;
$$;
