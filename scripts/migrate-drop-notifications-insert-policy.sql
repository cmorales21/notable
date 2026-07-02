-- Notable — Drop the client-side notifications INSERT policy
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times.
--
-- Prerequisite: migrate-mention-notification-trigger.sql (mentions were the
-- last notification type nominally created client-side).
--
-- This policy let any authenticated user insert arbitrary notification rows
-- (any type, any recipient) as long as they set themselves as actor — i.e.
-- fabricate like/follow/mention notifications without performing the action.
-- Every notification type is now created by security-definer triggers, which
-- bypass RLS, so no client insert path remains. With no INSERT policy, RLS
-- denies all client inserts outright.

drop policy if exists "Authenticated users can insert notifications" on notifications;
