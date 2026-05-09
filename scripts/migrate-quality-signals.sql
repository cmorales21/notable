-- Notable — Discovery quality signals migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — ALTER TABLE uses IF NOT EXISTS, function uses CREATE OR REPLACE.

-- ── Private profile flag ──────────────────────────────────────────────────────

alter table profiles
  add column if not exists profile_private boolean not null default false;

-- ── Discovery feed with quality scoring ──────────────────────────────────────
--
-- score = (like_count × 3) + (comment_count × 2) + (bookmark_count × 1)
--       + 10 / (1 + days_since_posted)
--
-- Private-profile filter: recs from private profiles are excluded from Discovery
-- unless the viewer (p_user_id) follows that user.

create or replace function get_discovery_feed(
  p_category  text,
  p_user_id   uuid    default null,
  p_limit     int     default 30,
  p_offset    int     default 0
)
returns table (
  id           uuid,
  user_id      uuid,
  category     text,
  title        text,
  description  text,
  image_url    text,
  external_url text,
  created_at   timestamptz
)
language sql
stable
security definer
as $$
  with scored as (
    select
      r.id,
      r.user_id,
      r.category,
      r.title,
      r.description,
      r.image_url,
      r.external_url,
      r.created_at,
      coalesce(lk.n, 0) * 3 +
      coalesce(cm.n, 0) * 2 +
      coalesce(bk.n, 0) * 1 +
      10.0 / (1.0 + extract(epoch from (now() - r.created_at)) / 86400.0) as score
    from recommendations r
    left join profiles pr on pr.id = r.user_id
    left join (
      select recommendation_id, count(*) as n from likes group by recommendation_id
    ) lk on lk.recommendation_id = r.id
    left join (
      select recommendation_id, count(*) as n from comments group by recommendation_id
    ) cm on cm.recommendation_id = r.id
    left join (
      select recommendation_id, count(*) as n from bookmarks group by recommendation_id
    ) bk on bk.recommendation_id = r.id
    where r.category = p_category
      and (
        -- include if profile is not private
        pr.profile_private is not true
        -- or viewer follows this user
        or (
          p_user_id is not null
          and exists (
            select 1 from follows f
            where f.follower_id = p_user_id and f.following_id = r.user_id
          )
        )
      )
  )
  select id, user_id, category, title, description, image_url, external_url, created_at
  from scored
  order by score desc
  limit p_limit
  offset p_offset
$$;
