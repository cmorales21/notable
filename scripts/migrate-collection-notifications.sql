-- Notable — Collection notifications migration (final Collections build step)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times.
--
-- Adds:
--   1. collection_id column on notifications (for collection like/bookmark refs)
--   2. 'collection_like' and 'collection_bookmark' to the type constraint
--   3. INSERT policy so client code can create collection notifications

-- ── 1. Add collection_id column ──────────────────────────────────────────────

alter table notifications
  add column if not exists collection_id uuid references collections(id) on delete cascade;

-- ── 2. Expand the type constraint ────────────────────────────────────────────

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
    'mention',
    'collection_like',
    'collection_bookmark'
  ));

-- ── 3. INSERT policy for client-side collection notifications ─────────────────
--
-- Existing like/bookmark notifications on recs are created by security-definer
-- triggers, but collection likes/bookmarks are inserted directly from the JS
-- client. This policy allows that.

create policy if not exists "Authenticated users can insert notifications"
  on notifications for insert
  with check (auth.uid() = actor_id);
