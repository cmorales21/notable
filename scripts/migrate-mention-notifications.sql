-- Notable — Add 'mention' to notifications type constraint
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
--
-- The notifications table was created with an inline check constraint named
-- notifications_type_check. This migration drops it and recreates it with
-- 'mention' included. Safe to run multiple times.

-- Step 1: drop the existing type constraint
-- (Postgres auto-names inline check constraints as <table>_<column>_check)
alter table notifications
  drop constraint if exists notifications_type_check;

-- Step 2: add the updated constraint including 'mention'
alter table notifications
  add constraint notifications_type_check
  check (type in ('follow', 'like', 'bookmark', 'comment', 'mention'));

-- If step 1 is a no-op (constraint had a different name), the add in step 2
-- will fail because the old constraint still exists. To find the real name run:
--   select constraint_name
--   from information_schema.table_constraints
--   where table_name = 'notifications' and constraint_type = 'CHECK';
-- Then replace 'notifications_type_check' above with the real name.
