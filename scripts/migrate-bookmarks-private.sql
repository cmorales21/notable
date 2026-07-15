-- Notable — Bookmarks privacy toggle migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — the statement uses IF NOT EXISTS and a default.

-- ── Bookmarks privacy flag ────────────────────────────────────────────────────
--
-- bookmarks_private : when true, the Bookmarked tab on the owner's profile is
--                     hidden from other viewers. Default false — bookmarks are
--                     public unless the owner explicitly opts in to hiding
--                     them via SettingsPanel > Privacy > "Private bookmarks".
--
-- The application already reads/writes this column (SettingsPanel.tsx,
-- profile/[handle]/page.tsx). This migration formalises the column so rows
-- created before the toggle shipped read the intended default (public) and
-- writes from the toggle no longer 400 with "column does not exist".

alter table profiles
  add column if not exists bookmarks_private boolean not null default false;
