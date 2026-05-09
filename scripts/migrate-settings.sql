-- Notable — Settings panel migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — all statements use IF NOT EXISTS / column defaults.

-- ── New notification preference columns on profiles ───────────────────────────
--
-- notify_followers : in-app notification for new followers (on by default)
-- notify_likes     : in-app notification for likes (on by default)
-- notify_comments  : in-app notification for comments (on by default)
-- email_digest_freq: frequency for email digest — 'weekly' or 'monthly'
--
-- notify_bookmarks and email_opted_in already exist from migrate-notifications.sql

alter table profiles
  add column if not exists notify_followers  boolean not null default true,
  add column if not exists notify_likes      boolean not null default true,
  add column if not exists notify_comments   boolean not null default true,
  add column if not exists email_digest_freq text    not null default 'weekly';
