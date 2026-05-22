Clean build. Now for Fix 7 — the RLS policy verification checklist:

  ---
  Supabase RLS Policy Verification Checklist
  
  Go to Database → Tables in your Supabase dashboard and verify each table
  below. For every table, click Policies and confirm the rules listed.

  ---
  profiles
  
  - SELECT — auth.uid() = id OR public read (depending on intent). If profiles
  can be private, public select should be blocked and replaced with a
  function/security-definer view.
  - UPDATE — auth.uid() = id only. No user should update another user's row.
  - INSERT — auth.uid() = id (triggered on signup, not open to arbitrary
  inserts).
  - DELETE — either disabled or auth.uid() = id.

  recommendations

  - SELECT — users should only see recs from non-private profiles (or their
  own). Consider a policy that joins to profiles.profile_private and follows.
  - INSERT — auth.uid() = user_id.
  - UPDATE — auth.uid() = user_id.
  - DELETE — auth.uid() = user_id.

  follows
  
  - SELECT — auth.uid() = follower_id OR auth.uid() = following_id.
  - INSERT — auth.uid() = follower_id (can't follow as someone else).
  - UPDATE — auth.uid() = following_id (only the followed person can
  accept/reject).
  - DELETE — auth.uid() = follower_id OR auth.uid() = following_id.

  likes

  - SELECT — open or auth.uid() = user_id.
  - INSERT — auth.uid() = user_id.
  - DELETE — auth.uid() = user_id.

  bookmarks

  - SELECT — auth.uid() = user_id (bookmarks are private by default).
  - INSERT — auth.uid() = user_id.
  - DELETE — auth.uid() = user_id.
  
  comments

  - SELECT — open or scoped to visible recs.
  - INSERT — auth.uid() = user_id.
  - UPDATE — auth.uid() = user_id.
  - DELETE — auth.uid() = user_id.

  notifications

  - SELECT — auth.uid() = user_id only. Notifications are private.
  - INSERT — should be restricted to service_role or a security-definer function
   only. Users must not be able to create notifications for others.
  - UPDATE — auth.uid() = user_id (for marking read).
  - DELETE — auth.uid() = user_id.

  user_blocks
  
  - SELECT — auth.uid() = blocker_id OR auth.uid() = blocked_id.
  - INSERT — auth.uid() = blocker_id.
  - DELETE — auth.uid() = blocker_id.

  comment_likes

  - INSERT — auth.uid() = user_id.
  - DELETE — auth.uid() = user_id.

  Storage bucket: avatars

  - INSERT — path must start with auth.uid() (enforced via bucket policy or
  check (storage.foldername(name))[1] = auth.uid()).
  - SELECT — public read is fine for avatars.
  - DELETE — (storage.foldername(name))[1] = auth.uid().

  ---
  How to verify a policy in the dashboard
  
  1. Database → Tables → [table] → Policies
  2. Click the pencil icon on each policy to read the USING and WITH CHECK
  expressions.
  3. For INSERT, only WITH CHECK matters (no existing row to match against).
  4. For UPDATE, both USING (which rows can be targeted) and WITH CHECK (what
  the row can be changed to) should be restricted.
  5. If a table has RLS enabled but no policies, all access is denied — confirm
  this is intentional.
  6. If a table has RLS disabled, all authenticated and anonymous users have
  full access — enable RLS and add appropriate policies.

  ---
  All 6 code fixes are implemented and the build is clean. Here's a summary of
  what changed:

  Fix: 1 SSRF
  File: api/search/extract-url/route.ts    
  Change: Added validateUrl() — blocks non-http/https schemes and private IP
    ranges before any fetch()              
  ──────────────────────────────────────── 
  Fix: 2 Private profiles                  
  File: (app)/rec/[id]/page.tsx            
  Change: Added privacy gate after profile fetch — unauthenticated users and
    non-followers are blocked from viewing recs from private profiles
  ────────────────────────────────────────
  Fix: 3 Profile update ID
  File: (app)/profile/[handle]/page.tsx
  Change: EditProfileModal now takes currentUserId prop and uses it (not
    profile.id) in the UPDATE .eq()
  ────────────────────────────────────────
  Fix: 4 Avatar validation
  File: (app)/profile/[handle]/page.tsx
  Change: Both upload handlers now reject non-image MIME types and files over 5
    MB before uploading
  ────────────────────────────────────────
  Fix: 5 Open redirect
  File: auth/callback/route.ts
  Change: next param is validated to start with / and not //; invalid values
    default to /lobby
  ────────────────────────────────────────
  Fix: 6 getSession → getUser
  File: (app)/notifications/page.tsx
  Change: Both getSession() calls replaced with getUser() for server-validated
    auth

