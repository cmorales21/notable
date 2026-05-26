-- Notable — Collections migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — all statements use IF NOT EXISTS.

-- ── 1. profiles: add collections_private column ───────────────────────────────

alter table profiles
  add column if not exists collections_private boolean not null default false;

-- ── 2. collections ────────────────────────────────────────────────────────────
--
-- A collection belongs to one user and groups recommendations together.
-- cover_recommendation_id: the rec whose image is used as the collection cover.
-- position: used for manual ordering within a user's collection list.

create table if not exists collections (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  name                    text        not null,
  description             text,
  is_private              boolean     not null default false,
  cover_recommendation_id uuid        references recommendations(id) on delete set null,
  position                integer     not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_collections_user
  on collections (user_id);

alter table collections enable row level security;

-- SELECT: visible if:
--   (a) the viewer is the owner, OR
--   (b) the collection is not private AND the owner's profile is not private, OR
--   (c) the collection is not private AND the viewer follows the owner
create policy "collections_select"
  on collections for select
  using (
    auth.uid() = user_id
    or (
      is_private = false
      and (
        -- owner has a public profile
        not exists (
          select 1 from profiles p
          where p.id = user_id and p.profile_private = true
        )
        -- or viewer follows the owner
        or exists (
          select 1 from follows f
          where f.follower_id = auth.uid()
            and f.following_id = user_id
            and (f.status = 'accepted' or f.status is null)
        )
      )
    )
  );

create policy "collections_insert"
  on collections for insert
  with check (auth.uid() = user_id);

create policy "collections_update"
  on collections for update
  using    (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "collections_delete"
  on collections for delete
  using (auth.uid() = user_id);

-- ── 3. collection_items ───────────────────────────────────────────────────────
--
-- Join table between collections and recommendations.
-- The unique constraint prevents the same rec from being added twice.

create table if not exists collection_items (
  id                uuid        primary key default gen_random_uuid(),
  collection_id     uuid        not null references collections(id)     on delete cascade,
  recommendation_id uuid        not null references recommendations(id) on delete cascade,
  added_at          timestamptz not null default now(),
  unique (collection_id, recommendation_id)
);

create index if not exists idx_collection_items_collection
  on collection_items (collection_id);

create index if not exists idx_collection_items_recommendation
  on collection_items (recommendation_id);

alter table collection_items enable row level security;

-- SELECT: visible if the parent collection is visible to the viewer
create policy "collection_items_select"
  on collection_items for select
  using (
    exists (
      select 1 from collections c
      where c.id = collection_id
        and (
          auth.uid() = c.user_id
          or (
            c.is_private = false
            and (
              not exists (
                select 1 from profiles p
                where p.id = c.user_id and p.profile_private = true
              )
              or exists (
                select 1 from follows f
                where f.follower_id = auth.uid()
                  and f.following_id = c.user_id
                  and (f.status = 'accepted' or f.status is null)
              )
            )
          )
        )
    )
  );

-- INSERT / DELETE: only the collection owner
create policy "collection_items_insert"
  on collection_items for insert
  with check (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

create policy "collection_items_delete"
  on collection_items for delete
  using (
    exists (
      select 1 from collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

-- ── 4. collection_likes ───────────────────────────────────────────────────────

create table if not exists collection_likes (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id)  on delete cascade,
  collection_id uuid        not null references collections(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (user_id, collection_id)
);

create index if not exists idx_collection_likes_collection
  on collection_likes (collection_id);

alter table collection_likes enable row level security;

create policy "collection_likes_select"
  on collection_likes for select
  using (true);

create policy "collection_likes_insert"
  on collection_likes for insert
  with check (auth.uid() = user_id);

create policy "collection_likes_delete"
  on collection_likes for delete
  using (auth.uid() = user_id);

-- ── 5. collection_bookmarks ───────────────────────────────────────────────────

create table if not exists collection_bookmarks (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id)  on delete cascade,
  collection_id uuid        not null references collections(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (user_id, collection_id)
);

create index if not exists idx_collection_bookmarks_collection
  on collection_bookmarks (collection_id);

alter table collection_bookmarks enable row level security;

create policy "collection_bookmarks_select"
  on collection_bookmarks for select
  using (true);

create policy "collection_bookmarks_insert"
  on collection_bookmarks for insert
  with check (auth.uid() = user_id);

create policy "collection_bookmarks_delete"
  on collection_bookmarks for delete
  using (auth.uid() = user_id);
