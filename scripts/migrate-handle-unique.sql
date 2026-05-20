-- Notable — Phase 20: Unique constraint on profiles.handle
--
-- Step 1: Resolve any existing duplicate handles (keeps the oldest row's
--         handle intact; renames later duplicates "carlos" → "carlos2", etc.)
-- Step 2: Add the UNIQUE constraint.
--
-- HOW TO RUN:
--   Supabase Dashboard → Database → SQL Editor → New query
--   Optional: run the SELECT at the bottom first to preview any duplicates.

-- ── Step 1 — Resolve duplicate handles ───────────────────────────────────────

DO $$
DECLARE
  dup_handle TEXT;
  dup_id     UUID;
  counter    INT;
  candidate  TEXT;
BEGIN
  FOR dup_handle IN
    SELECT handle
    FROM   profiles
    WHERE  handle IS NOT NULL
    GROUP  BY handle
    HAVING COUNT(*) > 1
  LOOP
    counter := 2;
    -- Walk the duplicates oldest-first; OFFSET 1 skips the keeper row
    FOR dup_id IN
      SELECT id
      FROM   profiles
      WHERE  handle = dup_handle
      ORDER  BY created_at ASC
      OFFSET 1
    LOOP
      -- Find the next free slot: "carlos2", "carlos3", …
      LOOP
        candidate := dup_handle || counter::TEXT;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE handle = candidate);
        counter := counter + 1;
      END LOOP;

      UPDATE profiles SET handle = candidate WHERE id = dup_id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- ── Step 2 — Add the UNIQUE constraint ───────────────────────────────────────

ALTER TABLE profiles
  ADD CONSTRAINT profiles_handle_unique UNIQUE (handle);

-- ── Preview — run this first to see duplicates before migrating ───────────────
-- SELECT handle, COUNT(*), array_agg(id ORDER BY created_at) AS ids
-- FROM   profiles
-- WHERE  handle IS NOT NULL
-- GROUP  BY handle
-- HAVING COUNT(*) > 1
-- ORDER  BY handle;
