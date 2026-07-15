-- Notable — Post images storage bucket
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — bucket insert is upserted, policies are dropped
-- before being recreated.
--
-- Creates the `post-images` bucket used by PostModal's manual photo upload.
-- Matches the shape of the existing `avatars` bucket:
--   Path layout: <auth.uid()>/<uuid>.<ext>
--   Public read: yes
--   Owner-only write / delete: enforced by policies below.
--
-- Prerequisite: none.

-- ── 1. Bucket ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = excluded.public;

-- ── 2. Policies ──────────────────────────────────────────────────────────────

-- Public read is fine; images are shown in feeds to any viewer of the post.
drop policy if exists "post-images: public read" on storage.objects;
create policy "post-images: public read"
  on storage.objects for select
  using ( bucket_id = 'post-images' );

-- Uploads must land under a folder matching the uploader's user id — this is
-- what actually enforces "only your own files" since the object owner column
-- would otherwise let any authenticated user write anywhere in the bucket.
drop policy if exists "post-images: owner insert" on storage.objects;
create policy "post-images: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Same rule for delete, so a user can clean up their own uploads later
-- (e.g. when a recommendation is removed) without touching anyone else's.
drop policy if exists "post-images: owner delete" on storage.objects;
create policy "post-images: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
