-- Notable — Admin queries
-- Paste any of these into the Supabase SQL Editor to review reports and moderation data.
-- Run them from the Supabase dashboard: Database → SQL Editor → New query.

-- ── User reports (most recent first) ─────────────────────────────────────────

select
  ur.created_at,
  ur.reason,
  reporter.name  as reporter_name,
  reporter.handle as reporter_handle,
  reported.name  as reported_name,
  reported.handle as reported_handle
from user_reports ur
join profiles reporter on ur.reporter_id      = reporter.id
join profiles reported on ur.reported_user_id = reported.id
order by ur.created_at desc;

-- ── Recommendation reports (most recent first) ────────────────────────────────

select
  rr.created_at,
  rr.reason,
  reporter.name  as reporter_name,
  reporter.handle as reporter_handle,
  r.title        as recommendation_title,
  r.category,
  author.name    as author_name,
  author.handle  as author_handle
from recommendation_reports rr
join profiles reporter on rr.reporter_id      = reporter.id
join recommendations r  on rr.recommendation_id = r.id
join profiles author   on r.user_id            = author.id
order by rr.created_at desc;

-- ── Comment reports (most recent first) ──────────────────────────────────────

select
  cr.created_at,
  cr.reason,
  reporter.name    as reporter_name,
  reporter.handle  as reporter_handle,
  c.text           as comment_text,
  commenter.name   as commenter_name,
  commenter.handle as commenter_handle
from comment_reports cr
join profiles reporter  on cr.reporter_id = reporter.id
join comments c         on cr.comment_id  = c.id
join profiles commenter on c.user_id      = commenter.id
order by cr.created_at desc;

-- ── Most-reported users (potential problem accounts) ──────────────────────────

select
  reported.name,
  reported.handle,
  count(*) as report_count
from user_reports ur
join profiles reported on ur.reported_user_id = reported.id
group by reported.id, reported.name, reported.handle
order by report_count desc;

-- ── All blocked pairs (most recent first) ────────────────────────────────────

select
  ub.created_at,
  blocker.name  as blocker_name,
  blocker.handle as blocker_handle,
  blocked.name  as blocked_name,
  blocked.handle as blocked_handle
from user_blocks ub
join profiles blocker on ub.blocker_id = blocker.id
join profiles blocked on ub.blocked_id = blocked.id
order by ub.created_at desc;

-- ── Delete a user account — DESTRUCTIVE, use with care ───────────────────────
-- Replace 'USER_HANDLE_HERE' with the actual handle before running.

-- select id, email from auth.users
-- where id = (select id from profiles where handle = 'USER_HANDLE_HERE');
--
-- delete from auth.users
-- where id = (select id from profiles where handle = 'USER_HANDLE_HERE');
