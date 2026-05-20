-- Notable — Follows RLS update policy + notifications insert policy
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — CREATE POLICY IF NOT EXISTS guards each statement.

-- ── 1. Allow the target user to accept/decline follow requests ────────────────
--
-- The follows table was created with INSERT and DELETE policies but no UPDATE
-- policy.  Without this, calling .update({ status: 'accepted' }) from the
-- client silently returns 0 rows and the follow stays in 'pending' forever.
--
-- The USING clause limits which rows can be updated (only rows where you're
-- the one being followed).  The WITH CHECK clause limits what the updated row
-- can look like (still must target you).

create policy if not exists "Following user can update follow status"
  on follows for update
  using    (auth.uid() = following_id)
  with check (auth.uid() = following_id);

-- ── 2. Allow app code to insert notifications ─────────────────────────────────
--
-- The original notifications table only allows trigger-based inserts (which
-- run as security definer and bypass RLS).  Direct client inserts — like the
-- "your follow request was accepted" notification — need this policy.
--
-- The constraint: the inserting user must be the actor_id (you can only
-- create notifications where you are the acting party).

create policy if not exists "Users can insert notifications as actor"
  on notifications for insert
  with check (auth.uid() = actor_id);
