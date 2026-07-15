-- Notable — Private-profile hardening for likes + bookmarks SELECT
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times.
--
-- Prerequisites:
--   • profile_private column on profiles (migrate-quality-signals.sql)
--   • bookmarks_private column on profiles (migrate-bookmarks-private.sql)
--
-- Context / bug:
--   The SELECT policies on likes and bookmarks were created before
--   profile_private landed and never picked up the private-profile guard that
--   the recommendations SELECT policy "Recommendations are viewable by allowed
--   users" already has. A private-profile user's likes and bookmarks are
--   consequently readable by strangers who query the tables directly — for
--   example, via the Liked / Bookmarked tab on the profile page, or any
--   client code that runs .from('likes') / .from('bookmarks') without an
--   equivalent client-side filter.
--
-- Fix:
--   Mirror the recommendations policy shape onto both tables. Rows from a
--   private profile are visible only to the owner or a viewer with an
--   accepted follow. For bookmarks the check combines with the owner's
--   bookmarks_private flag on the profiles table.
--
-- Policy names in the wild:
--   The names in the drop statements below cover the pre-Postgres-15
--   possibilities we've seen. If none of them match your DB, run
--     select policyname from pg_policies where tablename = 'likes';
--     select policyname from pg_policies where tablename = 'bookmarks';
--   to discover the current names, then add a matching `drop policy if
--   exists` line above each `create policy` before re-running.

-- ── 1. Likes SELECT policy ────────────────────────────────────────────────────

drop policy if exists "Likes are publicly viewable"             on likes;
drop policy if exists "Enable read access for all users"        on likes;
drop policy if exists "Anyone can view likes"                   on likes;
drop policy if exists "Users can view likes"                    on likes;
drop policy if exists "Likes are viewable by everyone"          on likes;
drop policy if exists "Likes are viewable by allowed users"     on likes;
drop policy if exists "likes_select"                            on likes;

create policy "Likes are viewable by allowed users"
  on likes for select
  using (
    -- owner always sees their own likes
    auth.uid() = user_id
    -- otherwise: owner's profile must not be private,
    or not exists (
      select 1 from profiles p
      where p.id = user_id and p.profile_private = true
    )
    -- ...or the viewer must follow the owner (accepted).
    or exists (
      select 1 from follows f
      where f.follower_id = auth.uid()
        and f.following_id = user_id
        and (f.status = 'accepted' or f.status is null)
    )
  );

-- ── 2. Bookmarks SELECT policy ────────────────────────────────────────────────

drop policy if exists "Enable read access for all users"        on bookmarks;
drop policy if exists "Anyone can view bookmarks"               on bookmarks;
drop policy if exists "Users can view bookmarks"                on bookmarks;
drop policy if exists "Bookmarks are viewable by everyone"      on bookmarks;
drop policy if exists "Bookmarks are viewable by allowed users" on bookmarks;
drop policy if exists "Public bookmarks are visible"            on bookmarks;
drop policy if exists "bookmarks_select"                        on bookmarks;

create policy "Bookmarks are viewable by allowed users"
  on bookmarks for select
  using (
    -- owner always sees their own bookmarks
    auth.uid() = user_id
    or (
      -- non-owners: owner must not have opted into private bookmarks
      not exists (
        select 1 from profiles p
        where p.id = user_id and p.bookmarks_private = true
      )
      and (
        -- AND the owner's profile must not be private,
        not exists (
          select 1 from profiles p
          where p.id = user_id and p.profile_private = true
        )
        -- ...or the viewer must follow the owner (accepted).
        or exists (
          select 1 from follows f
          where f.follower_id = auth.uid()
            and f.following_id = user_id
            and (f.status = 'accepted' or f.status is null)
        )
      )
    )
  );
