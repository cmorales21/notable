-- Discovery feed v2
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Changes vs v1:
--   1. Removed follow-exclusion — Discovery now surfaces ALL quality posts
--   2. New weights: likes×2, comments×3, bookmarks×3 (was 3/2/1)
--   3. Connection bonus: 1st-degree follows +8, 2nd-degree +3

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
  with
  -- Users that p_user_id directly follows (accepted only)
  first_degree as (
    select following_id
    from   follows
    where  follower_id = p_user_id
      and  status      = 'accepted'
  ),
  -- Users followed by p_user_id's follows (2nd-degree network, accepted only)
  -- 1st-degree members are also present here; the CASE below uses the higher bonus
  second_degree as (
    select distinct f2.following_id
    from   follows f1
    join   follows f2
           on  f2.follower_id = f1.following_id
           and f2.status      = 'accepted'
    where  f1.follower_id = p_user_id
      and  f1.status      = 'accepted'
  ),
  scored as (
    select
      r.id,
      r.user_id,
      r.category,
      r.title,
      r.description,
      r.image_url,
      r.external_url,
      r.created_at,
      -- Engagement score (v2 weights)
      coalesce(lk.n, 0) * 2 +
      coalesce(cm.n, 0) * 3 +
      coalesce(bk.n, 0) * 3 +
      -- Recency bonus: ~10 at post time, decays toward 0
      10.0 / (1.0 + extract(epoch from (now() - r.created_at)) / 86400.0) +
      -- Connection bonus: CASE short-circuits so 1st-degree always wins (no stacking)
      case
        when p_user_id is not null
             and r.user_id in (select following_id from first_degree)  then 8
        when p_user_id is not null
             and r.user_id in (select following_id from second_degree) then 3
        else 0
      end as score
    from recommendations r
    left join profiles pr on pr.id = r.user_id
    left join (
      select recommendation_id, count(*) as n from likes     group by recommendation_id
    ) lk on lk.recommendation_id = r.id
    left join (
      select recommendation_id, count(*) as n from comments  group by recommendation_id
    ) cm on cm.recommendation_id = r.id
    left join (
      select recommendation_id, count(*) as n from bookmarks group by recommendation_id
    ) bk on bk.recommendation_id = r.id
    where r.category = p_category
      and (
        -- Public profiles always visible
        pr.profile_private is not true
        -- Private profiles: only visible if the viewer follows them (accepted)
        or (
          p_user_id is not null
          and r.user_id in (select following_id from first_degree)
        )
      )
  )
  select id, user_id, category, title, description, image_url, external_url, created_at
  from   scored
  order  by score desc
  limit  p_limit
  offset p_offset
$$;
