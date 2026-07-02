-- Notable — Drop all client-side notifications INSERT policies
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times.
--
-- Prerequisite: migrate-mention-notification-trigger.sql (mentions were the
-- last notification type nominally created client-side).
--
-- Three INSERT policies were created over time (which ones exist depends on
-- which migrations were run):
--   "Users can insert notifications as actor"        (migrate-follows-update-policy.sql)
--   "Authenticated users can insert notifications"   (migrate-collection-notifications.sql)
--   "Users can insert follow-accept notifications"   (migrate-notifications-insert-policy.sql)
--
-- The broad ones let any authenticated user insert arbitrary notification
-- rows (any type, any recipient) as long as they set themselves as actor —
-- i.e. fabricate like/follow/mention notifications without performing the
-- action. RLS policies are OR-combined, so all must go. The narrow
-- follow-accept policy is also obsolete: fn_notify_follow's UPDATE branch
-- creates that notification (migrate-follow-accept-notification.sql).
--
-- Every notification type is now created by security-definer triggers, which
-- bypass RLS. With no INSERT policy, RLS denies all client inserts outright.

drop policy if exists "Users can insert notifications as actor" on notifications;
drop policy if exists "Authenticated users can insert notifications" on notifications;
drop policy if exists "Users can insert follow-accept notifications" on notifications;
