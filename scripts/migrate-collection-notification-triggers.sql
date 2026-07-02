-- Notable — Collection like/bookmark notification triggers
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — functions use CREATE OR REPLACE, triggers are
-- dropped before being recreated.
--
-- Prerequisite: migrate-collection-notifications.sql (adds the collection_id
-- column and the 'collection_like' / 'collection_bookmark' notification types).
--
-- Mirrors fn_notify_like / fn_notify_bookmark: owner lookup, self-skip,
-- preference check, and aggregation into an existing unread notification.

-- ── 1. Trigger: collection like → aggregated notification per collection ─────

create or replace function fn_notify_collection_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner        uuid;
  v_notify_likes boolean;
begin
  -- Look up whose collection was liked
  select user_id into v_owner
  from collections
  where id = new.collection_id;

  -- Skip if the collection was deleted or it's the owner liking their own
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

  -- Try to aggregate into an existing unread notification for this collection
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
  where user_id       = v_owner
    and type          = 'collection_like'
    and collection_id = new.collection_id
    and read          = false;    -- only aggregate into unread ones

  -- If no unread notification existed, create a new one
  if not found then
    insert into notifications (user_id, type, actor_id, actor_ids, collection_id)
    values (v_owner, 'collection_like', new.user_id, array[new.user_id], new.collection_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_collection_like on collection_likes;
create trigger trg_notify_collection_like
  after insert on collection_likes
  for each row execute function fn_notify_collection_like();

-- ── 2. Trigger: collection bookmark → aggregated notification per collection ─

create or replace function fn_notify_collection_bookmark()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner          uuid;
  v_notify_bkmarks boolean;
begin
  select user_id into v_owner
  from collections
  where id = new.collection_id;

  if v_owner is null or new.user_id = v_owner then
    return new;
  end if;

  -- Respect the owner's preference; default to true if column is somehow null
  select coalesce(notify_bookmarks, true)
  into v_notify_bkmarks
  from profiles
  where id = v_owner;

  if not v_notify_bkmarks then
    return new;
  end if;

  update notifications
  set
    actor_id   = new.user_id,
    actor_ids  = case
      when new.user_id = any(actor_ids) then actor_ids
      else array_append(actor_ids, new.user_id)
    end,
    read       = false,
    updated_at = now()
  where user_id       = v_owner
    and type          = 'collection_bookmark'
    and collection_id = new.collection_id
    and read          = false;

  if not found then
    insert into notifications (user_id, type, actor_id, actor_ids, collection_id)
    values (v_owner, 'collection_bookmark', new.user_id, array[new.user_id], new.collection_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_collection_bookmark on collection_bookmarks;
create trigger trg_notify_collection_bookmark
  after insert on collection_bookmarks
  for each row execute function fn_notify_collection_bookmark();
