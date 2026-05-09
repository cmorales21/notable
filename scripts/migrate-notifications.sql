-- Notable — Notifications migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).

-- ── 1. New columns on profiles ───────────────────────────────────────────────
--
-- email_opted_in   : whether the user wants an email digest (off by default)
-- notify_bookmarks : whether the user wants bookmark notifications (on by default)
-- Both default to safe, unobtrusive values.

alter table profiles
  add column if not exists email_opted_in   boolean not null default false,
  add column if not exists notify_bookmarks boolean not null default true;

-- ── 2. Notifications table ───────────────────────────────────────────────────
--
-- user_id   : who receives the notification (the post/account owner)
-- type      : one of follow | like | bookmark | comment
-- actor_id  : the most recent person who triggered it (shown in the text)
-- actor_ids : array of every person who triggered it — used for "and N others"
-- rec_id    : which recommendation this is about (null for follows)
-- read      : false until the user opens /notifications
-- updated_at: bumped on every aggregation update so the row floats to the top

create table if not exists notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id)      on delete cascade,
  type        text        not null check (type in ('follow', 'like', 'bookmark', 'comment')),
  actor_id    uuid        not null references profiles(id)      on delete cascade,
  actor_ids   uuid[]      not null default '{}',
  rec_id      uuid        references recommendations(id)        on delete cascade,
  read        boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Fast lookup: "give me all unread notifications for user X, newest first"
create index if not exists idx_notifications_user
  on notifications (user_id, read, updated_at desc);

-- ── 3. Row-level security ────────────────────────────────────────────────────
--
-- Users can only see their own notifications and only mark them as read.
-- Insertions are done by security-definer triggers below (bypasses RLS).

alter table notifications enable row level security;

create policy "Users can read their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications as read"
  on notifications for update
  using    (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 4. Trigger: new follow → one notification ────────────────────────────────
--
-- Fires when someone inserts a row into the follows table.
-- Never aggregated — each follow is its own notification.
-- "security definer" means it runs as the DB owner, so it can insert into
-- notifications on behalf of any user without tripping RLS.

create or replace function fn_notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never notify yourself (someone shouldn't be able to follow themselves,
  -- but this is a safety net)
  if new.follower_id = new.following_id then
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

drop trigger if exists trg_notify_follow on follows;
create trigger trg_notify_follow
  after insert on follows
  for each row execute function fn_notify_follow();

-- ── 5. Trigger: new like → aggregated notification per post ─────────────────
--
-- When Sofia likes "Past Lives", this fires.
-- If there's already an unread like notification for that post, it updates it
-- (adds Sofia to actor_ids, makes her the most recent actor, re-marks unread).
-- If not, it creates a fresh notification.
-- Once you've read the notification and then someone new likes it, you get a
-- fresh notification — the WHERE read = false ensures this.

create or replace function fn_notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  -- Look up whose recommendation was liked
  select user_id into v_owner
  from recommendations
  where id = new.recommendation_id;

  -- Skip if the recommendation was deleted or it's the owner liking their own post
  if v_owner is null or new.user_id = v_owner then
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

drop trigger if exists trg_notify_like on likes;
create trigger trg_notify_like
  after insert on likes
  for each row execute function fn_notify_like();

-- ── 6. Trigger: new bookmark → aggregated notification per post ─────────────
--
-- Identical logic to likes, but also checks whether the recipient has
-- bookmark notifications turned on (notify_bookmarks column on profiles).
-- If they've turned it off, the trigger exits silently.

create or replace function fn_notify_bookmark()
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
  from recommendations
  where id = new.recommendation_id;

  if v_owner is null or new.user_id = v_owner then
    return new;
  end if;

  -- Respect the user's preference; default to true if column is somehow null
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
  where user_id = v_owner
    and type    = 'bookmark'
    and rec_id  = new.recommendation_id
    and read    = false;

  if not found then
    insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
    values (v_owner, 'bookmark', new.user_id, array[new.user_id], new.recommendation_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_bookmark on bookmarks;
create trigger trg_notify_bookmark
  after insert on bookmarks
  for each row execute function fn_notify_bookmark();

-- ── 7. Trigger: new comment → individual notification ───────────────────────
--
-- Comments are personal — someone wrote words to you — so they are never
-- aggregated. Each comment creates its own notification.

create or replace function fn_notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner
  from recommendations
  where id = new.recommendation_id;

  if v_owner is null or new.user_id = v_owner then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
  values (v_owner, 'comment', new.user_id, array[new.user_id], new.recommendation_id);

  return new;
end;
$$;

drop trigger if exists trg_notify_comment on comments;
create trigger trg_notify_comment
  after insert on comments
  for each row execute function fn_notify_comment();

-- ── 8. Enable Supabase Realtime ──────────────────────────────────────────────
--
-- This makes the notifications table broadcast INSERT and UPDATE events
-- through Supabase's realtime websocket. The bell icon subscribes to this
-- to show the dot without a page refresh.
-- If this line fails with "publication does not exist", skip it and enable
-- realtime manually in Dashboard → Database → Replication.

alter publication supabase_realtime add table notifications;
