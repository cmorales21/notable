-- Notable — collection_items RLS policies
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times.
--
-- Adds SELECT and DELETE policies so:
--   • Collection owners can read and remove items from their own collections
--   • Anyone can read items in public collections (for non-owner views)
--   • INSERT is already handled by the AddItemsPicker component

-- ── 1. Enable RLS if not already enabled ─────────────────────────────────────

alter table collection_items enable row level security;

-- ── 2. SELECT: collection owner always sees their items ───────────────────────

create policy if not exists "Owner can select collection_items"
  on collection_items for select
  using (
    exists (
      select 1 from collections c
      where c.id = collection_items.collection_id
        and c.user_id = auth.uid()
    )
  );

-- ── 3. SELECT: anyone can read items in public, non-private-profile collections ──

create policy if not exists "Public collection items are visible"
  on collection_items for select
  using (
    exists (
      select 1 from collections c
      join profiles p on p.id = c.user_id
      where c.id = collection_items.collection_id
        and c.is_private = false
        and (p.profile_private = false or p.profile_private is null)
    )
  );

-- ── 4. INSERT: collection owner can add items ─────────────────────────────────

create policy if not exists "Owner can insert collection_items"
  on collection_items for insert
  with check (
    exists (
      select 1 from collections c
      where c.id = collection_items.collection_id
        and c.user_id = auth.uid()
    )
  );

-- ── 5. DELETE: collection owner can remove items ──────────────────────────────

create policy if not exists "Owner can delete collection_items"
  on collection_items for delete
  using (
    exists (
      select 1 from collections c
      where c.id = collection_items.collection_id
        and c.user_id = auth.uid()
    )
  );
