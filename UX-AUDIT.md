# Notable — UX Journey Audit

Findings are grouped by journey and sorted **BROKEN → CONFUSING → POLISH** inside each section. Every finding names the file and line so a fix pass can jump straight in. No code was modified for this audit.

---

## Summary — six sessions, 140 findings

| Journey | Focus | BROKEN | CONFUSING | POLISH | Total |
|---|---|---:|---:|---:|---:|
| 1 | Brand-new visitor signs up | 4 | 9 | 8 | 21 |
| 2 | Logged-out visitor arrives via shared link | 7 | 8 | 8 | 23 |
| 3 | Logged-in user browsing the feed | 4 | 10 | 10 | 24 |
| 4 | Logged-in user posts a recommendation | 6 | 11 | 11 | 28 |
| 5 | Identity + discovery (profile, follow, search, notifications) | 5 | 12 | 11 | 28 |
| 6 | Dead-ends sweep (routes, errors, empty/loading states, /settings) | 4 | 6 | 6 | 16 |
| **Total** | | **30** | **56** | **54** | **140** |

### Suggested fix order

The ordering below is by **blast radius × ease of fix**, not by which journey the finding lives in. Item counts in brackets are how many separate findings each fix collapses.

#### Tier 1 — Privacy leaks and silent data loss (do first, small diffs, big trust wins)

1. **Journey 5 B1 — Liked tab is publicly visible against a spec that says "Liked always private."** No `liked_private` column, no Settings toggle. Either gate the tab behind a new column or the existing `profile_private`, and add a matching toggle in `SettingsPanel > PrivacySection`. **[1]**
2. **Journey 5 B2 — Private-profile recs leak through search + `?rec=` shortcut.** Add a `.eq('profile_private', false)` (or an EXISTS-follow join) to `useSearch.fetchRecs` and to `CategoryFeed`'s `?rec=` auto-open fetch. Same class of leak in two files. **[1 → closes several path variants]**
3. **Journey 2 B4 — Private rec title / description / cover / recommender name leak in `/rec/[id]` OG image + metadata.** Gate `generateMetadata` and `opengraph-image.tsx` on `profile_private`. Reuse the page-body privacy check that already exists. **[1]**
4. **Journey 4 B2 — Failed URL-extract silently drops the outbound link on post.** Persist the raw URL as `external_url` even when preview extract fails; or block Post until the user confirms "post without preview." **[1]**
5. **Journey 3 B1 + B4 — Optimistic like / bookmark / comment-like writes fail silently.** Add a `toast('Something went wrong — try again')` inside `toggleEngagement`'s error branch (`src/lib/engagement.ts:50`) and inside the `checkedWrite` error paths for `comment_likes`. One helper edit closes both. **[2]**
6. **Journey 3 B2 — Card-level Delete doesn't check the write result.** Wrap the `.delete()` in `checkedWrite` (like `RecModal.tsx:182-194` already does) and only remove the card + toast on success. **[1]**
7. **Journey 6 B2 — Privacy + Notifications settings save fire-and-forget.** Replace `.then(() => {})` with `checkedWrite` + success/failure toasts. Two functions, four lines. **[1]**

#### Tier 2 — Dead-end funnels for signed-out visitors (converts trust into conversions)

8. **Journey 2 B1 + B2 + B3 + C4 — `/rec/[id]` has no Navbar, no signup CTA, no `?next=` preservation, and every internal link bounces to `/login` empty-handed.** Wrap `/rec/[id]` in a marketing shell (Navbar + "Save this — join Notable" pill), add `?next=` propagation in `middleware.ts:79-82`, and honour it in `login/page.tsx:33`. **[4 → also fixes Journey 1 C7 and Journey 5 B5]**
9. **Journey 2 B5 + B6 — Shared profile / collection URLs don't preview (protected route + missing `generateMetadata`).** Move `/profile/[handle]` and `/collections/[id]` (or public read-only variants) into a public prefix with proper OG. **[2]**
10. **Journey 4 B1 — Restaurants ➕ flow is a silent no-op.** Either surface a "Paste a Yelp / Google Maps URL, or add a photo" hint on the Restaurants pill, or route to `openManualSearch()` on select. Five-line diff. **[1]**
11. **Journey 4 B3 — Photo upload has no size / type check, no compression, no 5 MB cap despite what you thought was implemented.** Match the pattern from `handleAvatarUpload` in `profile/[handle]/page.tsx:559-584` (which does validate 5 MB + allowed MIME types + Supabase Storage) — inline base64 into a text column is the wrong shape long-term. **[1]**

#### Tier 3 — Consistency + copy sweep (medium effort, cross-cutting)

12. **All raw `error.message` renders (10 sites, verified in Journey 6).** Replace with mapped copy — Journey 1 lists specific ones (weak password, already registered, invalid email, rate limit) worth mapping. Fallback to `forgot-password/page.tsx:26`'s generic apology. **[6 findings across Journeys 1, 5, 6]**
13. **Journey 4 B4 + Journey 3 C2 — State reset semantics on category change / tab change.** Clear `confirmedItem` on category change in PostModal; persist Discovery/Following tab preference (URL param or user_metadata) across category switches. **[2]**
14. **Journey 6 B1 — `/settings` and `SettingsPanel` are two different subsets of the same settings.** Either redirect `/settings` → open the panel, or extract shared sections. Also solves Journey 6 C5 (two Sign Out buttons) and P1 (duplicate email-digest toggle). **[3]**
15. **Journey 3 C6 — Ignore confirmations use three different UI patterns.** Standardise on the overlay style used in `GroupedCard` / `RecModal` and delete the inline card in `RecommenderSection`. **[1]**
16. **Journey 5 C4 — Bell dot semantics.** Move the mark-all-read from page-mount to an explicit "Mark all as read" button; keep the dot cleared on route as a *visual* signal, not a *state mutation*. Also fixes Journey 5 P10. **[2]**
17. **Journey 6 C1 — Email digest opt-in has no unsubscribe language.** Add one line beneath the toggle. **[1]**

#### Tier 4 — Feed & discovery polish (nice-to-have, lower blast radius)

18. **Journey 3 C3 — Bookmarking mid-feed reshuffles Discovery.** Freeze the sort until the user leaves and returns, or exclude `bookmarkCounts` from the sort deps. **[1]**
19. **Journey 4 C2 + C3 — After posting, land on the poster's profile "Posted" tab or the destination feed with a highlighted "your post" card.** Fixes the "did it post?" moment. **[2]**
20. **Journey 5 C5 — Comment / follow-request notifications aren't aggregated.** Extend `groupNotifications` to include `comment` grouped by `rec_id`. **[1]**
21. **Journey 2 P4 — Comment likes render as raw ❤️ emoji.** Switch to SVG heart to match the rest of the app. **[1]**
22. **All P-level polish (54 findings).** Sweep as time allows — most are one-line copy tweaks (P2 warmer empty-state copy, P8 wordier bell empty state), consistent icon usage, or small consistency fixes across duplicated components.

### Cross-cutting patterns worth naming

- **`checkedWrite` swallows errors silently.** `src/lib/writes.ts:4-13` returns a boolean but few callers show a toast on `false`. Grepping for `checkedWrite(...)` calls where the return value is ignored will surface most of Journey 3 B1, B4, Journey 5 C4, Journey 6 B2 in one pass.
- **Optimistic updates without failure toasts.** Same class of bug in ~7 places (likes, bookmarks, comment-likes, ignore, follow, block, collection-membership). One shared helper — `optimisticEngagement(client, apply, apply_reverse, on_error_toast)` — would eliminate the drift.
- **Two-surfaces problem.** `/settings` vs. `SettingsPanel`, `AuthCard` (landing) vs. `/signup`, bell dropdown vs. `/notifications` full page. Each pair has divergent scope, copy, and behaviour. Consolidation is the highest-ROI code hygiene work.
- **Raw provider errors.** 10 sites across 8 files. A single `friendlyError(error)` helper called at the boundary would collapse the entire category.

---

## Journey 1 — Brand-new visitor signs up

**Path traced:** `/` (landing, `src/app/page.tsx`) → sign-up entry points (`Navbar` CTA, closing "Join Notable" CTA, inline `AuthCard`) → `/signup` form OR inline signup → Supabase `auth.signUp` → email confirmation link → `/auth/callback` → `/lobby` (which mounts `WelcomeOverlay` for onboarding) → normal lobby.

Two co-existing signup entry points were reviewed:
- **`AuthCard`** on the landing page (`src/app/components/AuthCard.tsx`) — only asks for name / email / password; defers handle to onboarding.
- **`/signup`** page (`src/app/signup/page.tsx`) — asks for name / handle / email / password up front.

The two flows diverge in several places that a real person will notice.

---

### BROKEN — a path fails or dead-ends

#### B1. `/signup` breaks entirely if Supabase email-confirmation is enabled
`src/app/signup/page.tsx:44-146`

The `/signup` page hard-codes the assumption that email confirmation is **off** (comment on line 67 says so out loud). After `auth.signUp` it:

1. Sets a session only if `authData.session` exists (line 70) — if confirmation is on, there is no session.
2. Immediately tries `supabase.from('profiles').insert(...)` (line 86) — without a session this fails RLS and returns a generic "Something went wrong creating your profile" (line 129).
3. Even on the "success" (2xx) branch, pushes to `/lobby` (line 145) — the middleware (`src/middleware.ts:79`) will bounce the still-signed-out user to `/login` with no explanation.

Net effect if confirmation is turned on in Supabase: the flow either shows a misleading error or silently dumps the user on `/login`, and they never learn to check their inbox. The `AuthCard` variant handles this case correctly (`AuthCard.tsx:101-105` sets `emailSent`), so behaviour is inconsistent by entry point.

#### B2. `/auth/callback` failures land on `/login` with no message
`src/app/auth/callback/route.ts:25, 51` → `src/app/login/page.tsx` (whole file)

The callback redirects to `/login?error=auth_callback_failed` in two failure paths:
- **Missing `code`** — happens when a user cancels Google OAuth mid-flow and Google still bounces back, or when a confirmation link is opened without a `code` param.
- **`exchangeCodeForSession` error** — happens when the confirmation link is **clicked twice** (code already consumed), when the link is expired, or when the session exchange fails for any other reason.

`src/app/login/page.tsx` never reads `searchParams` and never renders the `error` query string. The user arrives at a clean login screen with no hint that anything went wrong — they'll assume the link was broken and may re-request or give up.

#### B3. Category tiles on `/` dump anonymous visitors on `/login`
`src/app/page.tsx:274-293` (tile grid) + `src/middleware.ts:79-82`

The five landing-page category tiles link to `/books`, `/movies`, `/music`, `/restaurants`, `/podcasts` — all inside the `(app)` route group, which is protected. A first-time visitor exploring the marketing page clicks a tile expecting to see recommendations and is instantly kicked to `/login` with no explanation, breaking the "get in, get inspired" promise made in the hero.

This is the same category grid used on `/lobby`; the landing page appears to have been copy-pasted from the lobby without swapping the destinations for public preview pages (or gating the tiles behind auth-aware conditionals).

#### B4. No way to resend a confirmation email
Search across `src/` for `resend` / `resend_confirmation` returns zero hits.

If the confirmation email doesn't arrive (spam folder, typo in address, provider delay), the user is stuck: the `AuthCard` "Check your email" panel (`AuthCard.tsx:157-171`) is a dead end — no "resend" button, no "wrong email? go back" link, no way back to the form without a full reload. The email is also not persisted, so refreshing wipes even the "check your email" reassurance.

---

### CONFUSING — works, but a real person will be lost or see technical text

#### C1. Supabase / Postgres error strings are shown raw
- `src/app/components/AuthCard.tsx:84` (`setError(authError.message)`)
- `src/app/components/AuthCard.tsx:115` (`setError(error.message)`)
- `src/app/components/AuthCard.tsx:138` (Google OAuth start error)
- `src/app/signup/page.tsx:56` (`setError(authError.message)`)
- `src/app/signup/page.tsx:160` (Google OAuth start error)
- `src/app/(app)/lobby/WelcomeOverlay.tsx:79` (`setHandleError(error.message)`)

Weak password / invalid email / already-registered / rate-limit errors are surfaced verbatim from Supabase. Real users will see strings like `"Password should be at least 6 characters."`, `"Unable to validate email address: invalid format"`, `"User already registered"`, `"For security purposes, you can only request this after 60 seconds."` These are technically accurate but read like backend log lines and don't tell the user what to do next (e.g., "already registered" should offer a "sign in" link).

#### C2. "Weak password" enforcement is inconsistent between entry points
- `/signup` enforces `minLength={8}` (`signup/page.tsx:368`).
- `AuthCard` enforces `minLength={isSignup ? 8 : undefined}` (`AuthCard.tsx:266`) — 8 chars.
- Supabase's own minimum defaults to 6.

If Supabase's project minimum is set lower than 8, browsers block at 8 client-side but nothing tells the user *why* 8 — the input just refuses to submit with the generic browser tooltip. If Supabase's minimum is higher than 8 (or requires character classes), the client accepts but the server rejects with a raw Supabase string (see C1). No password-strength meter, no "must include a number" hint.

#### C3. Taken-handle experience on `/signup` costs the user the whole form
`src/app/signup/page.tsx:107-111, 127`

When the chosen handle is taken, the page keeps the auth user (correct — avoids "already registered" on retry, per the `createdAuthUserRef` comment), shows `"That handle is already taken — please choose another."`, and asks the user to try another handle. This is fine, **but** there's no live availability check (unlike `WelcomeOverlay` which has one, `WelcomeOverlay.tsx:43-61`) — the user only finds out after submitting the whole form. On slow connections this feels like the form is broken.

#### C4. Clicking the confirmation link twice looks identical to a broken link
`src/app/auth/callback/route.ts:48-52`

Second click → `exchangeCodeForSession` returns an error → redirect to `/login?error=auth_callback_failed`. Because the first click already signed the user in on the original device, the *second* click is almost always benign — the correct response is "you're already signed in, come on in." Instead the user sees a login page (with no error message thanks to B2), assumes the link expired, and is likely to try re-registering.

#### C5. Google OAuth cancellation is silent
`src/app/components/AuthCard.tsx:125-141` + `src/app/auth/callback/route.ts:24-26`

A user who clicks "Continue with Google", changes their mind on Google's consent screen, and hits **Cancel** will either:
- Stay on Google's page (no problem), or
- Be redirected back to `/auth/callback` with no `code` — the route sends them to `/login?error=auth_callback_failed` with no message (see B2). If they started from `/`, they never see the landing page again; they end up on a bare login form.

The `AuthCard` also leaves `googleLoading` stuck at `true` if the user closes the OAuth tab and hits browser-back to the original page, because the "on success, browser is redirected" comment (`AuthCard.tsx:141` region) means the "reset loading" branch only fires on the immediate SDK error, not on user cancellation upstream.

#### C6. Abandoned email confirmation → user is stranded
`src/app/components/AuthCard.tsx:157-171` (dead-end "Check your email" panel), also see B4.

If the user closes the tab before clicking the link, then comes back to `/` later:
- They can't sign in (no password confirmed).
- They can't re-sign up with the same email — Supabase returns `"User already registered"` (raw, see C1).
- There's no "already signed up? resend confirmation" affordance on `/login` or `/signup`.

This is the single most common real-world drop-off in email-confirmation flows and it's completely unhandled.

#### C7. Signed-in user visits `/`, `/login`, `/signup` — redirect is correct but abrupt
`src/middleware.ts:66-71`

A signed-in user hitting any of `/`, `/login`, `/signup` is redirected to `/lobby` — good, as intended by the recent fix (`session_persistence` memory). But the current fix does not redirect `/forgot-password` or `/reset-password` for signed-in users (fine for `reset-password` recovery sessions, but a signed-in user landing on `/forgot-password` sees the "forgot your password" form with no acknowledgement they're already signed in). Minor confusion, not a break — flagged here because it's part of the "signed-in user revisits entry pages" contract.

#### C8. Handle rules differ silently between `/signup` and `WelcomeOverlay`
- `/signup` (`signup/page.tsx:296`) strips whitespace and forces lowercase, but does **not** enforce length or character-class client-side. The `required` attr is the only guard.
- `WelcomeOverlay` (`WelcomeOverlay.tsx:46, 210-214`) enforces `/^[a-z0-9_]{3,20}$/`.

So a `/signup` user can submit `ab` (2 chars) or `me!` (punctuation) — the server may accept it (weakening handle quality) or reject it with a raw Postgres constraint message. Whichever branch fires, the user gets a different experience from the WelcomeOverlay path for no visible reason.

#### C9. Users who sign up via `/signup` see a redundant welcome overlay
`src/app/signup/page.tsx:145` → `src/app/(app)/lobby/page.tsx:77` → `WelcomeOverlay.tsx:29, 176-180`

A `/signup` user has already provided a handle. The lobby still mounts `WelcomeOverlay` because `is_onboarded` is `false`. Because `hasHandle` is true, `needsHandle` is `false`, and the overlay shows the "Thanks for signing up! Start exploring…" copy with "tap anywhere to continue". Functionally fine, but visually the user has just clicked "Create Account" 400ms ago and now sees another modal thanking them for signing up — slightly disorienting.

---

### POLISH — minor

#### P1. `is_onboarded` write can fail silently, showing the overlay again on next visit
`src/app/(app)/lobby/WelcomeOverlay.tsx:103-108` via `src/lib/writes.ts:4-13`

`checkedWrite` deliberately swallows errors and returns `false`. The overlay's dismiss handler does not check the return value — it calls `router.refresh()` and `setGone(true)` unconditionally (`WelcomeOverlay.tsx:110-111`). If the update fails (transient network, RLS regression), the overlay re-appears next visit with no explanation.

#### P2. Password field has no reveal toggle
`src/app/signup/page.tsx:361-385` and `AuthCard.tsx:259-271`. Every other modern signup has one; without it, mistyped passwords are the most common bounce cause. Cheap fix, high ROI.

#### P3. `emailRedirectTo` is not set on `auth.signUp` calls
`src/app/signup/page.tsx:44-54` and `src/app/components/AuthCard.tsx:77-81`

Both rely on the Supabase project's default `Site URL` for the confirmation-link destination. If someone changes that URL in Supabase (staging vs. prod, custom domain), email links will silently point somewhere else. Explicit `emailRedirectTo: '${origin}/auth/callback?next=/lobby'` would eliminate the coupling and is what the OAuth calls already do.

#### P4. Landing-page `AuthCard` defaults to signup view but reuses the same card for login
`src/app/components/AuthCard.tsx:42, 59-70`

Switching between signup and login triggers a 160ms opacity fade (`switchView`) and clears **all** state including any typed email. A user who mistakenly clicked "Sign in" and switches back loses whatever they'd typed — a small paper-cut on flaky networks where they may re-enter details a few times.

#### P5. `/signup` handle input has no live availability check
`src/app/signup/page.tsx:292-315`

The `WelcomeOverlay` has a debounced availability check; `/signup` doesn't. Users only learn the handle is taken after they've filled in name / handle / email / password and clicked submit. Copy the debounce logic from `WelcomeOverlay.tsx:43-61`.

#### P6. Navbar always shows "Sign In / Join Notable" — even for signed-in users
`src/app/components/Navbar.tsx:45-62`

The Navbar is used on `/` (server-redirected away for signed-in users, so this doesn't fire in practice) and on `/about`, `/privacy`, `/terms`, `/contact`. A signed-in user reading `/about` sees "Sign In / Join Notable" CTAs, which is stale UX. Not broken, just wrong for that audience.

#### P7. `/signup` submit button label says "Create Account", inline card says "Join Notable"
`src/app/signup/page.tsx:400` vs. `src/app/components/AuthCard.tsx:292`

Same action, two different labels reachable from the same landing page. Pick one.

#### P8. Handle input transformation is different between entry points
- `/signup` (`signup/page.tsx:296`): `.replace(/^@/, '').replace(/\s/g, '').toLowerCase()` — allows any non-space character.
- `WelcomeOverlay` (`WelcomeOverlay.tsx:208-214`): `.replace(/^@/, '').replace(/[^a-z0-9_]/g, '').toLowerCase().slice(0, 20)` — strips everything non-alphanumeric.

If a user types `alex.chen` at `/signup`, the field keeps the `.`; at `WelcomeOverlay`, the `.` is silently dropped as they type. Users notice.

---

## Journey 2 — Logged-out visitor arrives via a shared external link

**Path traced:** external link (usually pasted into iMessage / Slack / Twitter / a text) → `/rec/[id]` (`src/app/rec/[id]/page.tsx`) → the visitor either bounces or clicks a link on the page. Also spot-checked shareable-in-practice URLs `/profile/[handle]` (`src/app/(app)/profile/[handle]/page.tsx` + `layout.tsx`) and `/collections/[id]` (`src/app/(app)/collections/[id]/page.tsx`).

The `/rec/` prefix is whitelisted as public in `src/middleware.ts:28`, so the recommendation itself renders for signed-out visitors. `/profile/` and `/collections/` are **not** public prefixes, so they are protected by the auth redirect at `src/middleware.ts:79-82` — this is the source of most Journey 2 breakage on those URLs.

---

### BROKEN — a path fails or dead-ends

#### B1. Nothing on `/rec/[id]` tells a logged-out visitor to sign up
`src/app/rec/[id]/page.tsx:221-528`, plus absence of any top-level nav

There is no Navbar in the root layout (`src/app/layout.tsx`) and the rec page mounts no header of its own. So a shared-link visitor arrives, reads the recommendation, and has:
- No "Join Notable" / "Sign in" button anywhere on the page.
- No "Save this to your list — join in 10s" nudge next to the Save/Like/Comment pills.
- No sticky footer CTA.

The Like / Save / Comment pills (`page.tsx:389-434`) are rendered as `<div>` elements (not `<button>`) and have no click handlers, so a logged-out visitor sees interactive-looking chips that do nothing — worst of both worlds. The single call-to-action for signup on the entire page is the small underlined `@handle` link, which itself leads to `/login` (see B2).

#### B2. Every internal link on `/rec/[id]` is a broken funnel for logged-out visitors
`src/app/rec/[id]/page.tsx:227-240` (back link), `262-281` (category badge), `319-326` (recommender name/handle), `484-501` (comment authors), plus `src/middleware.ts:79-82` (protected route redirect)

Every internal link on the rec page points into the `(app)` route group:
- **"Back to Books"** → `/books` — protected, redirects to `/login`.
- **Category badge** → `/books` — same.
- **Recommender name / avatar** → `/profile/@handle` — protected, redirects to `/login`.
- **Comment authors** → `/profile/@handle` — same.

None of these redirects preserve the original URL as `?next=/rec/<id>`, so after the visitor logs in they're deposited at `/lobby` and have to hunt for the rec again. A shared-link visitor's *only* non-dead-end action is clicking the external URL (`page.tsx:355-386`), which takes them out of Notable entirely — a guaranteed bounce.

#### B3. Login redirect flow doesn't preserve `?next=`
`src/middleware.ts:79-82` and `src/app/login/page.tsx:33`

The middleware redirects unauthenticated users to `new URL('/login', request.url)` — no `?next=` param appended. Even if it were, the login page (`login/page.tsx:33`) hard-codes `router.push('/lobby')` after a successful sign-in and never reads any redirect parameter. So a Journey-2 visitor who converts (clicks Sign In from the rec, signs up, comes back) always ends up at the lobby with no context, having to remember and re-navigate to the URL they were sent.

Same story for the private-profile "Sign in" button (`src/app/rec/[id]/page.tsx:147-158`) and the not-found "Go to lobby" button (`page.tsx:112-123`).

#### B4. Private recommendations still leak title + description in link previews and OG image
`src/app/rec/[id]/page.tsx:64-90` (generateMetadata), `src/app/rec/[id]/opengraph-image.tsx:32-40, 96-256`

The page body correctly gates private-profile recs behind sign-in + follow (`page.tsx:133-186`). But **neither `generateMetadata` nor the OG image runs any privacy check**:

- `generateMetadata` unconditionally returns `title`, `description`, and OG tags for any rec (`page.tsx:69-89`).
- `opengraph-image.tsx:32-40` unconditionally fetches the rec and renders title + description + `image_url` + recommender name into a public 1200×630 PNG.

So if a private-profile user shares their rec link (or someone screenshots it), the resulting image and metadata expose:
- The full recommendation title (up to 60 chars).
- The description (up to 100 chars).
- The cover image.
- The recommender's real name / handle.

Anyone with the URL — Twitter's link-preview crawler, Slack's unfurl bot, an intended-private group chat that gets forwarded — gets everything except the comments and the "external link" button. This is both a data leak and a UX contradiction ("Private profile" copy on the page vs. an OG card that says otherwise).

#### B5. Shared profile URLs don't preview at all
`src/app/(app)/profile/[handle]/layout.tsx:1-38` + `src/middleware.ts:79-82`

`/profile/[handle]` has a well-crafted `generateMetadata` in the layout that produces name, bio, avatar OG tags. But the route lives inside `(app)`, which the middleware treats as protected. Social crawlers (unauthenticated) hit `/profile/@alex`, get redirected to `/login`, and index `/login`'s default metadata ("Notable"). Every profile URL shared in the wild previews as a bare "Notable" card — the beautifully-implemented `generateMetadata` code is unreachable for the audience it was written for.

#### B6. Shared collection URLs have no OG metadata *and* don't preview
`src/app/(app)/collections/[id]/page.tsx:1-2` (client component, no `generateMetadata`), no `layout.tsx` in that folder, protected route

Collections are a highly shareable artifact (a curated list is exactly the sort of thing people paste into a group chat). But `/collections/[id]/page.tsx` is a `'use client'` component and there is no `layout.tsx` alongside it, so no `generateMetadata` runs at all. Even without the middleware issue, a shared collection URL would preview as generic "Notable". Combined with the middleware bounce (same as B5), it's a double miss.

#### B7. `/rec/[id]` not-found and back-buttons dead-end signed-out visitors on `/login`
`src/app/rec/[id]/page.tsx:102-127, 147-158`

Both the "Recommendation not found" and "Private profile" screens include a single CTA button:
- Not-found → `Link href="/lobby"` (`page.tsx:113`). `/lobby` is protected. Signed-out visitor → `/login` (no `?next=`).
- Private profile → `Link href="/login"` (`page.tsx:148`). No `?next=/rec/<id>` — after login they land on `/lobby` and the original context is lost.

Neither screen sends the visitor back to the landing page (`/`), which is arguably the most useful destination for a stranger who just clicked a broken/private link.

---

### CONFUSING — works, but a real person will be lost or see technical text

#### C1. "Private profile" logged-out message uses the wrong verb order
`src/app/rec/[id]/page.tsx:141-159`

Copy: *"This recommendation is from a private profile. Sign in and follow this person to view it."* The signed-out visitor doesn't know **who** to follow (the recommender's handle isn't shown on this branch — it's rendered only in the full-rec body, which they can't see), and even if they did, "Sign in" takes them to `/login` with no `?next=`. So after signing in they'd have to remember the URL, navigate back, then find a follow button that's on the (also-hidden) profile page. The instructions are technically correct but practically unfollowable.

#### C2. "Private profile" logged-in-but-not-following screen offers no way to follow
`src/app/rec/[id]/page.tsx:172-185`

The signed-in-not-following branch shows *"Follow this person to view their recommendations."* — but renders no follow button and no link to the profile page. The user has to guess the recommender's handle from the URL that they didn't see, or navigate to `/lobby` and hope to find them. Meanwhile the recommender's handle and name are already loaded in the server component's `recProfile` and could trivially be surfaced with a "View @handle's profile" link.

#### C3. Malformed UUID looks identical to "genuinely deleted"
`src/app/rec/[id]/page.tsx:46-48, 102-127`

Postgres error code `22P02` (malformed UUID) is caught and treated as `null`, then rendered as "Recommendation not found — This recommendation may have been removed or the link is invalid." That's actually good copy — it covers both cases warmly, no raw Postgres. Flagging as CONFUSING (not POLISH) only because a truncated share URL (a common mistake) and a deleted rec produce identical UI; a small hint like "check the link is complete" would help.

#### C4. Rec page has no visible sign-in link at all
`src/app/rec/[id]/page.tsx` (whole page)

Unlike the landing page (which has `Navbar` with prominent Sign In / Join Notable buttons), the rec page renders no navigation shell. A logged-out visitor who wants to sign in has no obvious way to do so *unless* they figure out that clicking the recommender's handle bounces them to `/login`. This overlaps with B1 but is called out separately because the fix is different: B1 wants a "Save/Join Notable" CTA next to the pills; C4 wants a persistent header with Sign In.

#### C5. Comment authors' handles are clickable but useless for logged-out visitors
`src/app/rec/[id]/page.tsx:484-501`

Every comment shows the author's `@handle` as a link to `/profile/@handle`. For a logged-out visitor, all of these links bounce to `/login` (protected route, no `?next=`). Ten comments = ten dead links. From a curious visitor's perspective, the page appears rich with people to explore, and every attempt to explore fails.

#### C6. External-link pill occasionally renders as unclickable span
`src/app/rec/[id]/page.tsx:375-386` + `src/lib/url.ts:1-9`

If `external_url` has a non-http(s) protocol (rare, but possible: `mailto:`, `spotify:`, `itms-apps:`) `safeExternalHref` returns `undefined` and the page renders a `<span>` styled to look exactly like an anchor. A user who clicks and nothing happens has no explanation. Uncommon path; only reason to flag is that mobile Spotify deep-links are a plausible future embed.

#### C7. `ShareButton` fails silently on non-HTTPS, older browsers, or clipboard-blocked contexts
`src/app/rec/[id]/ShareButton.tsx:9-14`

`navigator.clipboard.writeText` throws in some browsers (older Safari, insecure origins, permissions denied). The handler doesn't `try/catch`, so the promise rejects, the "Link copied!" toast never appears, and the visitor sees a button that just… does nothing. On mobile, this is also a missed opportunity to use `navigator.share` for the native share sheet.

#### C8. OG image fetches Google Fonts CSS on every generation
`src/app/rec/[id]/opengraph-image.tsx:44-58`

Every OG image generation makes an outbound `fetch('https://fonts.googleapis.com/…')` call. On Google-Fonts flakiness, the code falls back to system serif (`opengraph-image.tsx:60-61`), so nothing breaks, but the image looks visibly different (Playfair Display vs. Times) between "Google was up" and "Google was down" generations. Baking the font file into the deploy would give consistent typography and a faster OG response.

---

### POLISH — minor

#### P1. `fetchRec` cache is per-request, so metadata + page + OG image each re-hit Supabase
`src/app/rec/[id]/page.tsx:39-60` uses React `cache()` which dedupes **within a single request**. But `opengraph-image.tsx` is a separate request (different route), and it re-fetches the same rec + profile independently (`opengraph-image.tsx:32-40`). Every share-link opening therefore causes 4 DB queries (metadata rec + metadata profile + page rec dedup'd + page profile dedup'd + OG rec + OG profile). Not user-visible, but worth mentioning for latency-sensitive social crawls.

#### P2. Recommender line renders "Unknown" if profile is null
`src/app/rec/[id]/page.tsx:328-330`

Fallback string `Unknown` is used if `profile` is null (deleted user, RLS block). Warmer copy — "A Notable member" or similar — would fit the site's tone better.

#### P3. Category badge and back link go to the same URL
`src/app/rec/[id]/page.tsx:227-240` (back link) and `262-281` (badge) both point to `cat.href`. Not a bug — just visually the same button pair in two positions. For a logged-out user both are dead ends (see B2); for a logged-in user it's fine but redundant.

#### P4. Comment likes shown as raw emoji `❤️ 3`
`src/app/rec/[id]/page.tsx:503-507`

Everywhere else the app uses SVG heart icons (`page.tsx:399-401`). The comment section deviates to a raw `❤️` character, which will render differently across OS/font stacks and looks inconsistent with the top-level like pill on the same page.

#### P5. `/rec/[id]` page has no client-side interactivity for signed-in users either
`src/app/rec/[id]/page.tsx:389-434`

The like / bookmark / comment pills are static counts even for signed-in users. Compare to `/lobby` and `/profile/[handle]` which use `RecommendationCard` with full interaction. This isn't strictly a Journey-2 issue, but it means a signed-in user who clicks a shared rec link gets a worse experience than the same rec inside their feed — reducing the incentive to actually click shared links. Worth pairing with B1's "Save" CTA rework.

#### P6. OG image title truncates at 60 chars mid-word
`src/app/rec/[id]/opengraph-image.tsx:18-20, 92` — `truncate` cuts at exactly N-1 chars then appends `…`. Not word-boundary aware. E.g., `"The Peripheral by William Gibson is one of the best…"` might become `"The Peripheral by William Gibson is one of the b…"`. Cheap fix; small perceived quality win in previews.

#### P7. Not-found layout doesn't use the app's shared `not-found.tsx`
`src/app/rec/[id]/page.tsx:102-127` renders an inline JSX block. The shared `src/app/not-found.tsx` has warmer copy ("your next great recommendation is one tap away") and links to `/` (which works for logged-out users), not `/lobby` (which doesn't). Reusing the shared component — or better, calling `notFound()` from Next.js — would fix B7 and P7 together.

#### P8. Profile OG metadata exposes `avatar_url` even for private profiles
`src/app/(app)/profile/[handle]/layout.tsx:11-13, 27, 35`

Profile privacy isn't checked in the layout's `generateMetadata`. Currently moot because the middleware blocks unauthenticated crawlers (B5), but if `/profile/` is ever added to `PUBLIC_PREFIXES` to fix B5, this becomes the same class of leak as B4 for recs. Flag now so the fix for B5 doesn't accidentally regress privacy.

---

## Journey 3 — Logged-in user browsing the feed

**Path traced:** `/lobby` (`src/app/(app)/lobby/page.tsx`) → tile click → `/books` | `/movies` | `/music` | `/restaurants` | `/podcasts` (each is a thin server component that mounts `CategoryFeed`, e.g., `src/app/(app)/books/page.tsx`) → `CategoryFeed` (`src/app/components/CategoryFeed.tsx`) → `GroupedCard` (`src/app/components/feed/GroupedCard.tsx`) → tap → `GroupedModal` / `RecModal` / `RecommenderSection` (`src/app/components/feed/GroupedModal.tsx`, `RecModal.tsx`, `RecommenderSection.tsx`) → like / bookmark / comment / external link / close / switch tabs / switch categories.

The five category tiles all point to routes that exist (`page.tsx` verified for `/books` — the other four follow the same pattern). Every category page mounts the same `CategoryFeed` component with a different `category` prop, so the findings below apply uniformly across all five feeds.

---

### BROKEN — a path fails or dead-ends

#### B1. Like / bookmark writes fail silently — user thinks the toggle worked
`src/lib/engagement.ts:42-51` used by `src/app/components/CategoryFeed.tsx:302-335`, `src/app/components/feed/GroupedModal.tsx:259-292`, `src/app/components/feed/RecommenderSection.tsx:104-138`

`toggleEngagement` optimistically calls `apply(next)`, attempts the insert/delete, and on error re-calls `apply(isActive)` to roll back — **but never toasts, never surfaces the error**. Meanwhile the callers proactively toast the *optimistic* action:

- `CategoryFeed.tsx:306` — `toast(liked ? 'Unliked' : 'Liked')` fires **before** the write.
- `GroupedModal.tsx:262, 280` — same pattern for like and bookmark.

So the sequence a user sees when the server write fails is: heart animation → filled heart → "Liked" toast → filled heart silently reverts to empty. Same for bookmark ("Saved" then the bookmark quietly un-fills). `RecommenderSection.tsx:104-138` doesn't even toast — the animation just plays and reverses. Users have no way to tell a like was lost vs. successfully saved, especially on flaky networks where this matters most.

#### B2. Card-level "Delete" doesn't check the write result
`src/app/components/feed/GroupedCard.tsx:114-124`

```
await supabaseRef.current.from('recommendations').delete()...
setDeleteConfirm(false)
onDelete?.(leadRec.recommendation_id)   // removes from UI unconditionally
toast('Recommendation removed')
```

There is no `error` check. If RLS rejects (e.g., session expired) or the network drops, the card vanishes from the feed *and* the toast confirms deletion, but the row still exists in the DB. On refresh the "deleted" rec reappears. Users interpret this as data loss on the server side and lose trust in delete generally. Contrast with the RecModal path (`RecModal.tsx:182-194`) which does use `checkedWrite` and toasts a failure message — inconsistent behaviour between two delete buttons that look identical.

#### B3. Auto-open of `?rec=<id>` fails silently on invalid / removed IDs
`src/app/components/CategoryFeed.tsx:421-463`

When the feed URL contains `?rec=<id>` (from a shared link back into the feed), the code first checks in-memory groups, then falls back to a Supabase fetch. If both come up empty, the effect just returns — no toast, no URL cleanup. The user opened a link that was supposed to expand a specific rec and instead lands on the generic feed with the "?rec=..." still stuck in the URL. Combined with Journey 2's shared-link dead ends, this is the second-order failure of the same class.

#### B4. Comment-like failures roll back silently with no toast
`src/app/components/feed/RecModal.tsx:105-125` and `src/app/components/feed/RecommenderSection.tsx:153-173`

Both use `checkedWrite` with a `revert` callback but do not toast on failure. The user sees the heart fill, the count increment, then both revert without explanation. This is the same class of bug as B1, applied to a smaller surface but with identical UX cost.

---

### CONFUSING — works, but a real person will be lost or see technical text

#### C1. Card comment count vs. modal comment count can diverge
`src/app/components/feed/GroupedCard.tsx:382-383` (uses `group.total_comments`) vs. `src/app/components/feed/GroupedModal.tsx:378-380` (multi-recommender header says "N people recommended this") and `RecommenderSection.tsx:400-405` (each recommender shows their own `commentCount`)

The card shows the *aggregate* comment count across all recommenders in the group. When the user opens a multi-recommender modal, they see per-recommender counts that don't add up to the card's number in any obvious visual way. Example: card says "12", modal shows three sections with 3 / 5 / 4 next to their little comment icon. Users hunt for the missing zero comments and wonder if the site is buggy.

#### C2. Discovery/Following tab preference resets whenever the user switches category
`src/app/components/CategoryFeed.tsx:55` — `useState<'discovery' | 'following'>('discovery')`

`CategoryFeed` is per-route, so navigating `/books` → `/movies` unmounts and remounts a fresh instance. A user who has explicitly set Following on Books, hops to Movies to check something, and comes back to Books finds themselves back on Discovery. There's no persistence (localStorage, URL param, user preference on the profile) — the tab resets 5 times as they browse.

#### C3. Bookmarking a mid-feed item can reshuffle the entire Discovery feed
`src/app/components/CategoryFeed.tsx:339-358` — `useMemo` has `bookmarkCounts` in its dep array; Discovery re-sorts by a scoring formula that includes `groupBookmarks * 3`.

When you bookmark rec #7, `bookmarkCounts` changes, `groupedRecs` re-computes, and Discovery re-sorts. Because the formula weights bookmarks heavily, the item you just bookmarked can visibly jump up (or occasionally down) the list. Users experience it as "why did the feed just shuffle?" — especially disorienting because the shuffle happens *after* the bookmark animation, so it feels like a second, unexplained event.

#### C4. Tab switch flashes the loading skeleton even when data would be cached
`src/app/components/CategoryFeed.tsx:70-79` — `fetchFeed` unconditionally calls `setLoading(true)` and `setRecs([])` at the top before any awaits.

Switching Discovery ↔ Following blanks the feed and shows `FeedSkeleton` for the entire fetch duration, even if the user just came back from the other tab a second ago. There is no in-memory cache per-tab. On a slow connection this makes rapid switching feel much heavier than it should.

#### C5. Rapid category switches after a `notable:new-post` event can update a stale component
`src/app/components/CategoryFeed.tsx:396-406`

The `notable:new-post` handler creates its own `AbortController`, calls `fetchFeed(ctrl.signal)`, and never stores the controller or aborts it on unmount. If the user posts something in a new tab, then navigates categories before the fetch completes, React will warn "Can't perform a state update on an unmounted component." The user won't see the warning, but the fetch happens for nothing and the state writes are dropped — the destination category won't reflect the new post until the next manual refresh.

#### C6. Ignore confirmations use two different UI patterns in the same session
- `src/app/components/feed/GroupedCard.tsx:390-423` — full-card overlay with a semi-transparent linen background and Cancel / Ignore pills.
- `src/app/components/feed/RecModal.tsx:707-741` — full-modal overlay with the same style.
- `src/app/components/feed/RecommenderSection.tsx:408-443` — an **inline** confirmation card slotted below the recommender, not an overlay.

A user who ignores from the recommender section inside a grouped modal gets a totally different-looking confirmation UI than the same action from the card. Both work, but the inconsistency looks accidental.

#### C7. `handleShare` in the modal fails silently on non-HTTPS / permission-denied
`src/app/components/feed/GroupedModal.tsx:240-246` and `src/app/components/feed/RecModal.tsx:196-200`

`navigator.clipboard.writeText(url)` is called without a `try/catch`. If the clipboard API is unavailable (older Safari, some in-app browsers, permission denied), the `await` rejects, execution stops, and `toast('Link copied')` never fires. Users see the share button do nothing. This is the same pattern already flagged for `ShareButton.tsx` in Journey 2 — worth grouping when fixing.

#### C8. Overlapping avatars on multi-recommender cards look clickable but aren't
`src/app/components/feed/GroupedCard.tsx:21-51` — `OverlappingAvatars` renders bare `<Avatar>` elements with no links.

For single-recommender cards (`GroupedCard.tsx:206-212`), the avatar is wrapped in `<Link href="/profile/{handle}">`. On multi-recommender cards, the same-looking avatar pile is *not* linked — clicking any avatar just bubbles to the card `onClick` and opens the modal. The user's mental model ("avatars are always the person") breaks silently. If the intent is "open the group modal, see the individual list", make the pile non-avatar (a stacked-icon glyph) or make each mini-avatar link to that person's profile.

#### C9. The "+N more" bubble hides everyone past index 2
`src/app/components/feed/GroupedCard.tsx:23, 36-48`

When 4+ people recommend the same title, the user sees 3 avatars + a "+N" bubble. Clicking the "+N" does the same thing as clicking the card — opens the grouped modal. But that only becomes obvious after clicking. The bubble looks like a menu affordance ("view the others"). Making it visibly clickable (hover state, tooltip) or listing more names in the attribution text would help.

#### C10. Auto-open modal from `?rec=` may fire after component unmount
`src/app/components/CategoryFeed.tsx:421-463`

The async fetch inside the `useEffect` on line 430 has no cleanup — if the user navigates away between `setSelectedGroup` and `setSelectedGroup` again, React logs an "update on unmounted component" warning. Not user-visible, but symptomatic of an unpaired async call that could produce stale state elsewhere if the timing shifts.

---

### POLISH — minor

#### P1. `hasMore` is inferred from `fetchedRecs.length === 30`
`src/app/components/CategoryFeed.tsx:148, 235`

When a category has exactly 30 recs, the sentinel triggers a `loadMore` that returns 0 and *then* sets `hasMore=false`. The user sees a spinner for a beat before the end-of-feed note appears. A `count: 'exact'` header on the initial query or a cheaper "N+1 pattern" (`.limit(31)` and drop the extra) would remove the phantom fetch.

#### P2. Following tab: 0-follows and 0-recs cases both use good copy but the same icon
`src/app/components/CategoryFeed.tsx:513-526` — both empty states show `<EmptyStateIcon category={cat} />`.

The 0-follows case ("You're not following anyone yet") is a *user* action problem, but the icon is category-themed (a book, a musical note, etc.). A person-shaped or "follow" glyph would better convey the fix ("go follow people"). Copy is warm, icon is off-theme.

#### P3. `endOfFeed` note references "recommendations" but the tone doesn't rotate per-category
`src/app/components/CategoryFeed.tsx:574-583`

`"That's everything for now. Time to go enjoy the recommendations."` is nice but generic across all five categories. Compare with `DISCOVERY_DESCRIPTIONS` (line 467-473) which speaks the category's language ("What's worth reading?", "Where's worth going?"). The end-of-feed note could match ("Time to go read something." / "Time to go eat somewhere.") for a small but memorable delight.

#### P4. RecModal's Comment action-button focuses the input even for logged-out users
`src/app/components/feed/RecModal.tsx:511-523`

The "Comment" pill focuses the input regardless of `currentUserId`. In practice this can't be exercised because the feed lives behind `(app)`, but the submit disable at `RecModal.tsx:681` uses `!commentInput.trim() || submittingComment` — not `!currentUserId`. If the auth invariant ever relaxes (e.g., a public preview mode), this becomes a silently broken form.

#### P5. Modal "liked" and "bookmarked" state don't re-sync from prop changes
`src/app/components/feed/GroupedModal.tsx:199-201` and `src/app/components/feed/RecommenderSection.tsx:50-53`

State initialized from `useState(leadRec.is_liked_by_user)` won't update if the parent's `is_liked_by_user` changes while the modal is open (e.g., another optimistic update elsewhere on the page). Rare in practice because modals are short-lived and single-instance, but a `useEffect(..., [leadRec.is_liked_by_user])` sync would keep it honest.

#### P6. `RichMediaEmbed` failure silently falls back to a plain image without notifying the user
`src/app/components/feed/GroupedCard.tsx:302-306` and `src/app/components/RichMediaEmbed.tsx:99-115`

When Spotify / Apple Music / SoundCloud / Bandcamp embed API calls fail, `onFail()` flips `embedFailed=true` and the UI reverts to a static image + external link. Fine as a fallback, but a subtle "Preview unavailable" microcopy would preempt "why doesn't the music play here?" tickets.

#### P7. `getExternalLinkLabel` returns different fallbacks in different files
`src/app/components/feed/helpers.tsx:39-51` returns `'View →'` on parse failure.
`src/app/rec/[id]/page.tsx:23-35` returns `'View source →'` on parse failure.

Same label, different fallback strings. Should share one helper. (Already flagged as helpers duplicate in P8 of Journey 2 by implication; noting again because it surfaces in Journey 3's feed too.)

#### P8. Category page `<title>` doesn't reflect the active tab
`src/app/(app)/books/page.tsx:4-18` sets a static title. Users switching tabs, opening the tab list, or bookmarking `/books` on Following get the same "Books — Notable" title. Minor SEO / recall issue.

#### P9. Feed sticky header measures 56px offset — verify it matches the actual app-shell nav height
`src/app/components/CategoryFeed.tsx:483` — `top: '56px'` hard-coded.

If `AppShell` changes its nav height in a future redesign, the sticky category header will overlap or leave a gap. A CSS var (`--app-nav-height`) would be safer.

#### P10. `TeaserText` measures scrollHeight only on mount and on `text` change
`src/app/components/feed/helpers.tsx:96-101`

Font loading (Playfair, DM Sans) can shift line heights *after* mount. If the fonts finish loading after the `useEffect` runs, the "see more" affordance may show or hide incorrectly. A `ResizeObserver` on the paragraph, or measuring on `document.fonts.ready`, would eliminate the flicker on cold visits.

---

## Journey 4 — Logged-in user posts a recommendation

**Path traced:** `AppShell` ➕ button → `PostModal` (`src/app/components/PostModal.tsx`) → category pill → contentEditable compose → auto-search / manual search / paste-URL / photo upload → `ResultRow` confirm → optional description text → duplicate check → `createOrMatchItem` (`src/lib/items.ts`) → `recommendations.insert` → dispatch `notable:new-post` → `router.push('/{category}')` → new post visible in feed.

External search API routes verified: `/api/search/books` (Open Library), `/api/search/movies` (TMDB, requires `TMDB_API_KEY`), `/api/search/music` (iTunes), `/api/search/podcasts` (iTunes), `/api/search/extract-url` (OG scrape with SSRF guards). **No `/api/search/restaurants` route exists** — restaurant posts fall through a dead branch in `PostModal.searchCategory` at line 293.

---

### BROKEN — a path fails or dead-ends

#### B1. Restaurants: pick the pill, get a silent no-op
`src/app/components/PostModal.tsx:293` (`if (cat === 'restaurants') return`), `585` (manual search returns early), `1235-1251` (manual-search button is *hidden* for restaurants — replaced by an empty `<span />`)

Real user experience for `restaurants`:
1. Tap the ➕ button.
2. Tap the Restaurants pill.
3. Type "Bestia" into the textarea.
4. Nothing happens. No dropdown, no spinner, no border pulse, no "search coming soon" hint.
5. Scroll around looking for "Can't find it? Search manually" — that button is *invisible* on this category.
6. Give up.

The intended manual-entry fallback is: paste a Yelp / Google Maps / TripAdvisor URL (URL detection at `PostModal.tsx:511-514` triggers `extract-url`, which has `yelp.com` / `tripadvisor.` handlers at `extract-url/route.ts:445-457`) *or* upload a photo. Neither is signposted anywhere in the UI. A first-time restaurant poster has no way to discover this path without reading the source.

#### B2. Pasted URL that fails to extract silently loses the outbound link
`src/app/components/PostModal.tsx:343-373` (`extractUrl`), `644-647` (URL stripped from description on post), `697` (`external_url` only from `confirmedItem`)

Flow: user pastes `https://cool-restaurant.com`. `extractUrl` calls `/api/search/extract-url`. If the site 404s / times out / has no OG tags / returns non-2xx:
- `extract-url` returns either an error status or `{ title: '' }`.
- `PostModal:353-356` toasts *"Couldn't load a preview for that link"* — good.
- `confirmedItem` is **not** set (line 359 guards on `data.title`).
- The URL is still visible in the textarea.
- User thinks "OK I'll post text + URL anyway" and clicks Post.
- `handlePost:644-647` strips *all* URLs from the description via `.replace(/https?:\/\/[^\s]+/gi, '')`.
- `external_url` field is set from `confirmedItem?.external_url` (null in this case).
- **The URL is gone.** The rec posts with no outbound link and no visible reference to the source.

This is silent data loss on a common failure mode (any URL whose target lacks OG tags).

#### B3. Photo upload has zero validation — no size cap, no type check, no compression
`src/app/components/PostModal.tsx:625-631` (`handleFileChange`), `1270-1276` (file input: `accept="image/*"`, no `capture`, no size guard), `696` (`image_url: uploadedImage ?? confirmedItem?.image ?? null`)

The prompt asked about "the 5 MB cap message wording" — **there is no cap and no message**. `handleFileChange` reads *any* file the OS lets through as a base64 data URL via `FileReader.readAsDataURL` and dumps it into `recommendations.image_url` as-is on post. Consequences:
- A 30 MB HEIC from an iPhone becomes ~40 MB of base64 sitting in a Postgres text column, embedded in every subsequent feed query that touches this rec.
- Upload of `evil.pdf` renamed to `evil.pdf.jpg` succeeds at the file-input layer (browser doesn't sniff), reads its bytes as a data URL, and gets posted. The image won't render, but the DB row is polluted.
- On very large files, `.insert` may fail with a raw Supabase error the user sees as *"Something went wrong posting your recommendation — please try again."* with no hint that the photo is the problem.

There is also no cropping, no rotation, no EXIF stripping, and no error path for `FileReader.onerror`.

#### B4. Switching category does NOT clear a previously confirmed item
`src/app/components/PostModal.tsx:548-565` (`handleCategorySelect`), `569-576` (`handleConfirm`)

Repro: pick Books → type "The Bear" → confirm the book search result → change your mind → tap Music pill. The book cover, title, and subtitle remain locked in as `confirmedItem`. Post button is enabled. Post succeeds. Feed shows a **Music** rec with a book cover and the book's title. `handleCategorySelect` only clears the *dropdown* (`line 552`), never `confirmedItem`.

Related: `syncCategory` at `line 248` doesn't clear `uploadedImage` either. A confusing but rarer scenario.

#### B5. Photo-only / no-title posts silently save as "Untitled"
`src/app/components/PostModal.tsx:245` (`canPost` allows uploadedImage-only), `650-651` (`title = ... || 'Untitled'`)

`canPost = !!category && (!!confirmedItem || !!uploadedImage || text.replace(URL_RE, '').trim().length > 5)`. A user with a photo and no text (they meant to type but forgot, or hit Post prematurely) posts a card literally titled "Untitled" to the feed. No warning, no confirm prompt. The rec is stuck with that title until they open the modal from RecModal and edit it. Feed rows with "Untitled" as the display heading are worse than a rejected post would have been.

#### B6. `handleFileChange` doesn't reset the input value — re-selecting the same file is a silent no-op
`src/app/components/PostModal.tsx:625-631`

If the user picks a photo, removes it via the ✕ overlay, and picks the *same* photo again, the `<input type="file">` doesn't fire `onChange` because the value didn't change. The camera button appears to do nothing. Users interpret this as "the app is broken" rather than "browser file-input quirk". A one-line `e.target.value = ''` after reading would fix it.

---

### CONFUSING — works, but a real person will be lost or see technical text

#### C1. Auto-search failure is silent; manual-search failure is verbal
`src/app/components/PostModal.tsx:334-338` (auto: 400 ms border pulse only) vs. `1383-1387` (manual: "No results found" text)

When the auto-search from the compose textarea returns zero hits, the *only* signal is the compose border pulsing accent-colour for 400 ms. Users on a slower connection interpret the pulse as "still searching". When they switch into the manual-search mode and type the same query, they get an explicit "No results found" message. Same failure, two different UX languages, in the same modal.

#### C2. `router.push('/{category}')` after posting lands on Discovery, where a brand-new post isn't necessarily at the top
`src/app/components/PostModal.tsx:707-713` and `src/app/components/CategoryFeed.tsx:339-358` (Discovery scoring formula)

After post-success, the user is pushed to `/books` (etc.). The default tab is Discovery, which sorts by `total_likes * 2 + total_comments * 3 + bookmarks * 3 + recency-bonus (max 10)`. A brand-new rec has 0 likes / 0 comments / 0 bookmarks → the recency bonus (≈10) is competing directly with older popular posts that already have 5–10 engagements. If any group has ≥5 likes, it outranks the fresh rec. The user posts, lands on the feed, doesn't see their post, and thinks it didn't post — even though the "Recommendation posted!" toast already fired.

Compounding: the `notable:new-post` event fires *before* the router push (`line 708` vs. `709-712`), so if the user is already on the destination category, both the event handler and the route change trigger `fetchFeed` — two overlapping fetches for the same page.

#### C3. No visible "your post" affordance in the destination feed
Same file path as C2

Even if the sort worked in the poster's favour, there's no highlight, no "You posted this X seconds ago" chip, no "See your post" link. Compare to Twitter/Threads/etc. where new-post confirmation is glued to the composer. Notable just… drops you on the feed and lets you look.

#### C4. Duplicate check is a strict `ilike` — near-duplicates slip through
`src/app/components/PostModal.tsx:653-664`

The check is `.eq('user_id', user.id).ilike('title', title)`. `ilike` without wildcards is a case-insensitive equality. "Bestia" and "Bestia LA" are treated as different titles. So a user can post "Bestia" today, "Bestia LA" tomorrow, "bestia la" next week — no warning any time. The whole point of the check is to catch dupes; the current implementation only catches exact re-posts.

Also worth noting: the fallback title for a photo-only post is "Untitled" (see B5). Post two photo-only recs in a row → both titled "Untitled" → the *second* one triggers the "Already recommended" duplicate warning. The user is confused because they didn't type "Untitled" anywhere.

#### C5. `text > 5 chars` gate on posting is invisible to the user
`src/app/components/PostModal.tsx:245`

The Post button greys out until `confirmedItem`, `uploadedImage`, or `text.replace(URL_RE, '').trim().length > 5`. The "> 5" threshold isn't documented anywhere. A user typing "yes!" (4 chars) with no other input sees a persistently-greyed Post button with no explanation why. They will assume the modal is broken.

#### C6. "Paste a URL instead" is buried at the bottom of the dropdown, not offered when nothing is typed
`src/app/components/PostModal.tsx:1149-1154`

The line "Not here? Paste a URL instead" only renders *inside* an already-populated dropdown. Users who type "Bestia LA" (no results because it's Restaurants — see B1) never see this hint. Users whose auto-search finds nothing don't see it either because the dropdown is hidden. The one class of user who could benefit — the "I have a URL, why don't I just paste it" user — is exactly the class who never triggers the render.

#### C7. Error is a red button styled to look non-clickable
`src/app/components/PostModal.tsx:1394-1407`

Post-failure error is rendered as `<button onClick={() => setError(null)}>...`. It looks like a static error banner. No affordance signals "click to dismiss." Users read the message, see nothing interactive, and click the ✕ (which triggers the discard-changes overlay). The intended dismiss target — the error itself — is not discoverable.

#### C8. Category pill "unselect" is invisible until the user tries it
`src/app/components/PostModal.tsx:549`

`const next = category === cat ? null : cat` — tapping the currently-selected pill *unselects* it. Nothing tells the user this is possible, and once unselected, all category-gated behaviour (search, item creation) silently stops. A user who unselects thinking "I'll pick a different one later" then types and expects search to fire will get nothing until they re-select.

#### C9. External search timeouts are effectively unbounded
`src/app/components/PostModal.tsx:302-308` (no client-side timeout on the search fetches)

`extract-url` uses a 5-second `AbortController` server-side. The category search endpoints (`/api/search/books`, `/movies`, `/music`, `/podcasts`) do not, and neither does `PostModal.searchCategory` on the client. If iTunes / TMDB / Open Library is slow, the "searching" border pulse animates until the browser's default fetch timeout (which can be minutes) or the user's patience runs out. A 3–5 second client-side abort with a "Search took too long — try again" fallback would be much friendlier.

#### C10. `notable:new-post` and `router.push` fetch overlap on the destination feed
`src/app/components/PostModal.tsx:708-712` + `src/app/components/CategoryFeed.tsx:396-406` (event listener re-fetches) + `useEffect` re-fetch on mount

If the user's ➕ button dispatches from a page that already has `CategoryFeed` mounted (e.g., the user is *on* `/books` when they post a book), the event handler re-fetches immediately, then `router.push('/books')` is a no-op that still calls `router.refresh()` and triggers useEffect re-mounts. Two overlapping fetches, two skeleton flashes. Not user-visible as bugs, but wasted latency at the exact moment they want confirmation.

#### C11. iframe / embed paste "smart handling" is undocumented magic
`src/app/components/PostModal.tsx:430-464`

Pasting a raw `<iframe src="https://open.spotify.com/embed/...">` blob is detected and converted into a canonical URL (`open.spotify.com/track/...`), then extracted. Users who paste iframes hit this successfully — but the vast majority of users don't try. And the users who do try are typically pasting *for* the embed HTML preservation; the transformation drops the width/height and any styling. Cool feature, mostly invisible.

---

### POLISH — minor

#### P1. Description silently truncates at 1000 characters with no counter
`src/app/components/PostModal.tsx:648` (`.slice(0, 1000)`)

The compose textarea shows no character count, no warning at 950, no error at 1001. Long recommendations get quietly clipped on post. RecModal *does* show a `/280` counter for comments (`RecModal.tsx:697-701`) and `/2000` for description edits (`RecModal.tsx:420-422`). Inconsistent.

#### P2. HEIC on iPhone won't preview
`src/app/components/PostModal.tsx:1273` — `accept="image/*"` allows `.heic`, but `next/image` in the confirmed preview (`line 1210`) may not render it in the browser.

Users upload a photo from their iPhone camera roll, see the preview area render broken / blank, and don't know why. A subtle "Please pick a JPG or PNG" fallback or client-side conversion to JPEG would rescue this.

#### P3. `handleFileChange` never surfaces `reader.onerror`
`src/app/components/PostModal.tsx:628-631`

No `onerror` handler. A corrupted / unreadable file silently sets `uploadedImage` to `undefined` (via `ev.target?.result` being null), and the preview doesn't render — user thinks the upload button is broken.

#### P4. Post-success delay is a fixed 1000 ms
`src/app/components/PostModal.tsx:709-713`

The "Posted ✓" state holds for a full second before navigating. Fine as a confirmation flourish, but on a slow route change (data-heavy Discovery feed on a cold cache) the total perceived latency from click to seeing the destination page is 1 s + skeleton time. Halving to 500 ms would still read as confirmation.

#### P5. No preview / retry when `createOrMatchItem` fails
`src/app/components/PostModal.tsx:670-687` catches all `createOrMatchItem` failures with `/* non-fatal */`.

Failure means the rec is inserted with `item_id: null`, which excludes it from any downstream grouping / cross-user recommendation-of-the-same-thing feature. Non-critical, but the swallowed error path deserves at least a `console.warn` so this doesn't go silent in production.

#### P6. Search results max out at 8 external + 4 Notable
`src/app/components/PostModal.tsx:299-300, 326` — hard-coded limits.

Reasonable defaults, but users searching for a common title ("Dune", "The Beatles") may not see the specific edition they meant. A "Show more" affordance would help without cluttering the default view.

#### P7. Extract-URL server timeout is 5s; PostModal spinner has no visible timeout signal
`src/app/api/search/extract-url/route.ts:158-159, 200-201, 386` + `PostModal.tsx:345-372`

If the OG scrape hits its 5s abort and returns an error, `PostModal` toasts the "Couldn't load a preview" message. But there's no indicator during those 5 seconds that a slow site is the reason — just the border pulse. A "Fetching preview…" caption for URL-triggered lookups would set expectations.

#### P8. `getExternalLinkLabel` returns different fallback strings than the rec page copy
Already flagged as P7 of Journey 3; same helper duplicated in `/api/search/extract-url/route.ts` domain logic and `feed/helpers.tsx`. Extracting a canonical `linkLabel(url)` shared helper would improve consistency.

#### P9. Post button uses accent color for both "post" and duplicate-warning "Post anyway"
`src/app/components/PostModal.tsx:868-874`

The overlay's "Post anyway" button matches the category accent. Given that it's a *warning* action (bypass duplicate check), a neutral secondary style would better convey the "I know what I'm doing" affordance and reduce accidental clicks by users still reading the warning.

#### P10. Category-hint whisper renders *after* the category pill row
`src/app/components/PostModal.tsx:975-977`

The "Select the topic for your recommendation" whisper (`post-category-hint`) sits below the pills. New users often pick a pill before noticing the hint. Placing it above the pills, or triggering it only after 3+ seconds of no interaction, would fit its purpose better.

#### P11. Whole flow can be under 30 seconds — but only if the happy path works
Composite of the above.

Happy path (Books/Movies/Music/Podcasts, search hits, no photo, short blurb): tap ➕ → tap pill → type 2 words → tap result → type "loved it" → tap Post → wait 1 s → feed. Under 20 seconds is achievable.

Sad paths that stretch beyond a minute (or defeat the user):
- Restaurants without knowing about paste-URL trick (see B1).
- Search API slow or returns nothing, user has to switch to manual mode.
- Photo upload where HEIC preview doesn't render (see P2).
- Discovery feed doesn't show the fresh post (see C2/C3).

The core flow is fast; the failure surfaces around it are what make Journey 4 feel long.

---

## Journey 5 — Identity and discovery surfaces

**Path traced:** top-right avatar in `AppShell` → `/profile/{handle}` (`src/app/(app)/profile/[handle]/page.tsx`) → tabs (Posted / Liked / Bookmarked / Collections) → `EditProfileModal` (`src/app/components/profile/EditProfileModal.tsx`) → `SettingsPanel > PrivacySection` (`src/app/components/SettingsPanel.tsx:445-520`). Then someone else's profile → follow / follow-request / block flows. Then `/search` (`src/app/(app)/search/page.tsx` + `src/app/hooks/useSearch.ts`) with both title and `@handle` queries. Then `/notifications` (`src/app/(app)/notifications/page.tsx`) + the `AppShell` bell dropdown (`src/app/components/AppShell.tsx:332-494`) with realtime subscription and per-type navigation via `getNotifHref` (`src/lib/notifications.ts:109-117`).

---

### BROKEN — a path fails or dead-ends

#### B1. "Liked always private" spec is violated — the Liked tab is public
`src/app/(app)/profile/[handle]/page.tsx:684-692`, comment on line 684: `// Liked is always public. Bookmarked is shown only to owner or when explicitly public.`

The spec you stated is "Liked always private, Bookmarked public-by-default with toggle." Code says the exact opposite for Liked:

```
const showBookmarked = isOwnProfile || profile?.bookmarks_private === false
const tabs: TabId[] = [
  'posted',
  'liked',                                          // ← unconditional, no privacy gate
  ...(showBookmarked ? ['bookmarked' as TabId] : []),
  ...(showCollections ? ['collections' as TabId] : []),
]
```

Any signed-in visitor can hit `/profile/@alex`, tap Liked, and browse Alex's likes with the same interactivity as their own. There is also **no `liked_private` toggle anywhere in `SettingsPanel` or `EditProfileModal`** — the user cannot make it private even if they wanted to. Compared with Bookmarks (which are gated correctly by the `bookmarks_private` column), Likes are treated as a public engagement signal. Either the spec is wrong or the tab needs the same gate — right now this is a real privacy leak.

#### B2. Private profiles' recommendations leak through `/search`
`src/app/hooks/useSearch.ts:76-113` (`fetchRecs` — no privacy filter) + `src/app/components/CategoryFeed.tsx:421-463` (`?rec=<id>` auto-open — also no privacy check)

Searching by title hits `recommendations` unfiltered:

```
supabase.from('recommendations').select('*').ilike('title', `%${cleanQuery}%`)
```

The result includes recs by private-profile authors even when the searcher is a stranger. Clicking a result at `search/page.tsx:371` does `router.push('/{category}?rec=<id>')`, which lands on the category feed. `CategoryFeed`'s `?rec=` auto-open effect (`CategoryFeed.tsx:421-463`) fetches the rec + profile and opens the modal **without** checking `profile_private` or follow status. So the full rec — title, description, image, external URL, comments — pops up for someone the private-profile owner never approved.

Compare with `src/app/rec/[id]/page.tsx:133-186`, which explicitly gates the identical content behind sign-in + follow. The two entry paths for the same rec have opposite privacy behaviour.

#### B3. Deleted-rec notifications look clickable but stall on the feed
`src/lib/notifications.ts:114` (`getNotifHref` returns `/{category}?rec=<rec_id>` even when the underlying rec has been deleted) + `CategoryFeed.tsx:421-463` (silent no-op path)

When a rec is deleted, its `notifications` rows stay (no cascade delete visible in the code) but `rec.title` / `rec.category` can go null → `getNotifHref` sometimes returns null (good) and sometimes returns a stale category route (bad). If it returns the route, the user clicks a notification like "@Alice liked your recommendation," lands on `/books?rec=<deleted-id>`, and sees the generic feed with no modal — same silent failure flagged in Journey 3 B3, but reached via a *notification* the user was told to trust.

#### B4. Blocked-me users still expose name / handle / bio / avatar + follow counts
`src/app/(app)/profile/[handle]/page.tsx:137-179, 693`

If `they` blocked `me`, `theyBlockedMe = true` and the render enters `isPrivateAndGated` branch (`line 994-1011`), showing "This profile is private" copy. But the profile *header* above that gate (`line 727-960`) has already rendered their `name`, `handle`, `avatar_url`, `bio`, follower count, and following count — all fetched unconditionally on `line 138-161` before the block state was even evaluated. Standard block semantics on other platforms are "you can't see them at all"; here the block is only enforced against recommendations and the private-gate copy is misleading (it says "private", not "blocked"). Reveals both existence and metadata to a user who was intentionally cut off.

#### B5. `/profile/@nobody` (no such handle) is warm-but-warmless
`src/app/(app)/profile/[handle]/page.tsx:700-707`

`notFound` state renders:
> Profile not found
> @nobody doesn't exist.

No navigation back to `/lobby` / `/search` / `/`. If the user hit this from a mistyped URL or a broken external link, they're stranded on a barren screen with only the app-shell nav to escape. A "search for people" CTA or a `/search?q=@nobody` shortcut would make the dead end recoverable.

---

### CONFUSING — works, but a real person will be lost or see technical text

#### C1. Edit Profile modal has zero privacy controls
`src/app/components/profile/EditProfileModal.tsx:74-206` (name / bio / handle / avatar only)

Users expect "Edit Profile" to be the one place to change everything about their profile. Privacy toggles live in `SettingsPanel > PrivacySection` — a totally separate surface reached by the gear icon in the top-right, not the Edit Profile button. New users hunting for "make my profile private" open Edit Profile, see only name / bio / avatar, and give up.

The handle is also displayed as read-only (`line 165-170`) with no "change handle" affordance — an intentional choice, but no explanatory copy tells the user *why* they can't edit it.

#### C2. Bookmarks "public-by-default" only works if `bookmarks_private` is exactly `false`
`src/app/(app)/profile/[handle]/page.tsx:685` — `profile?.bookmarks_private === false` (strict equality)

If a profile row has `bookmarks_private = null` (any user whose row predates the migration that introduced the column, or any row where the default didn't backfill), the strict check fails and Bookmarks is hidden from other viewers. The `SettingsPanel:459-461` also uses `data.bookmarks_private ?? false` — so the toggle UI shows "public" while the profile page treats it as private. Two views of the same field, different defaults. Reproduce path: freshly-migrated user hasn't clicked the toggle → their bookmarks are hidden even though Settings says "Bookmarks are visible on your profile."

#### C3. "This profile is private" gate reuses the same copy for two very different states
`src/app/(app)/profile/[handle]/page.tsx:693-696, 994-1011`

`isPrivateAndGated` fires in three semantically different situations:
- Truly private profile, I'm not a follower.
- Truly private profile, I've requested to follow (pending).
- **They blocked me** (`theyBlockedMe && !isOwnProfile`).

The rendered copy switches only between "Your follow request is pending" and "Follow this person to see their recommendations." A blocked user gets the second string, is invited to Follow, taps Follow, and either the DB rejects (silent tosat from `checkedWrite`) or a follow row is created that they can't act on. Either way the user learns nothing about being blocked.

#### C4. Bell dot's "cleared" semantics differ from full-page's "mark-read" semantics
`src/app/components/AppShell.tsx:117-123` (dot cleared on pathname change) vs. `src/app/(app)/notifications/page.tsx:110-113` (auto-mark-all-read on load)

Two behaviours are conflated:
- Bell dot cleared → visual signal only. `hasUnread` state reset to false, but individual `notifications.read` rows are untouched.
- Full-page load → *actually* writes `read = true` on every unread row for this user.

Meaning: if the user opens `/notifications`, glances, and closes the tab, everything is marked read on the server even though they may only have processed a couple of items. There is no "keep unread" or "mark selected as read" affordance. On a busy notif day this loses signal.

#### C5. Notification aggregation is inconsistent between types
`src/lib/notifications.ts:57-90` (`groupNotifications`)

- `like` + `bookmark` on the same rec: aggregated into "N people liked your recommendation" — one row.
- `collection_like` + `collection_bookmark`: aggregated per collection — one row.
- `comment` and `mention`: **not aggregated at all** — three comments on the same rec show as three separate rows.
- `follow_request`: not aggregated — each in its own row.
- `follow_request_accepted`: not aggregated.

A rec that hits Reddit and gets 40 likes + 5 comments looks like "@X and 39 others liked" (1 row) + 5 comment rows. Fine on desktop, chaotic on mobile.

#### C6. Bell dropdown uses `getRelTimeCompact`; full page uses `formatRelativeTime`
`src/app/components/AppShell.tsx:419, 464` vs. `src/app/(app)/notifications/page.tsx:419`

Same notification renders "1h" in the dropdown and "1 hour ago" in the full page. Not a bug, but users notice — and the compact form on the full page (or the verbose form on the dropdown) would be more consistent whichever direction you go.

#### C7. Follow-request notification in the bell has no explicit routing target
`src/app/components/AppShell.tsx:410-440` renders inline Accept/Decline buttons but no way to open the requester's profile.

A user might reasonably want to peek at `@X` before accepting. In the dropdown they can't — the row has no click target that goes to `/profile/@X`. The full-page follow-request section (`notifications/page.tsx:324-373`) has the same problem: no link on the name/avatar. Only the Accept/Decline buttons are clickable.

#### C8. "@handle" search silently ignores anyone without a handle
`src/app/(app)/search/page.tsx:436` — `if (!person.handle) return null`

Bare `useSearch` returns any profile whose `name` matches — even those with `handle = null`. The render then filters them out silently. A newly-signed-up user (see Journey 1 — signup can complete without a handle if they used the `AuthCard` path and haven't finished the welcome overlay) exists in `profiles` but is invisible in every search. If someone tries to `@` them from PostModal (which requires handles too), same effect.

#### C9. `groupedRecs` in search doesn't respect `ignored`/`blocked` recommenders symmetrically
`src/app/hooks/useSearch.ts:38-53, 108-112` (blocks filtered; user_ignores NOT filtered)

The hook filters recs whose author blocked me / whom I blocked. It doesn't filter recs whose author I've `ignored` (via `user_ignores` — see `CategoryFeed.tsx:82-95` which does filter these in the feed). So a user I ignored can still appear as a recommender in my search results, defeating the point of the ignore. Same story for the people list.

#### C10. Search sends the user into `/{category}?rec=<id>` which is a modal-inside-a-feed, not a dedicated view
`src/app/(app)/search/page.tsx:371`

Clicking a rec result opens `CategoryFeed` with the `?rec=` auto-open modal. That's clever, but three things go sideways:
- The URL still displays as `/books?rec=<id>` after modal close (no URL cleanup — see Journey 3 B3).
- Refreshing loses the modal state unless the `?rec=` param persists.
- The user's mental model was "I searched for X, I'm looking at X" — instead they end up "browsing Books with a modal open." Small friction that adds up.

`/rec/[id]` exists (`src/app/rec/[id]/page.tsx`) as a dedicated view and would be a cleaner destination for search — but see Journey 2 B1/B2 for what needs fixing there first.

#### C11. Ilike wildcard characters in search queries aren't escaped
`src/app/hooks/useSearch.ts:80` — `.ilike('title', `%${cleanQuery}%`)`

A user searching for `50%` or `a_b` gets unexpected wildcard matches ("anything containing 50 followed by anything," "anything containing a-any-char-b"). Not a security issue (`.ilike` is parameterised), but the results confuse. The `%`/`_` in the query should be escaped before interpolation.

#### C12. Search input on the search page and the search dropdown in AppShell aren't connected
`src/app/components/AppShell.tsx:194-204` (searchPanelRef state) + `src/app/(app)/search/page.tsx:92-107` (its own input state)

Two search UIs live in the same app: the AppShell search panel and the `/search` page. Typing "Dune" in the shell, hitting Enter → user expected to land on `/search?q=Dune` with the text pre-filled. Verify by scanning: `AppShell` never navigates to `/search?q=`. The two search entry points don't hand off — muscle memory across sessions gets punished.

*(Not verified in this pass because `AppShell.tsx` was only partially read; flagging as a strong smell to confirm.)*

---

### POLISH — minor

#### P1. Follow / Following / Requested pill has three labels but only two hover states
`src/app/(app)/profile/[handle]/page.tsx:855-861`

The pill reads "Following" (accepted) / "Requested" (pending) / "Follow" (none). On hover, the first two switch to "Unfollow" / "Cancel" in red. "Follow" doesn't change on hover, so users don't see any affordance until click. A subtle "Follow" → "Follow" (bolder colour) or fill state would improve tactile feedback.

#### P2. "Bookmarks" empty state on someone else's profile is oddly reachable
`src/app/(app)/profile/[handle]/page.tsx:1308-1313`

Because the auto-redirect at `line 294-297` fires only when `bookmarks_private !== false`, users on public-bookmarks profiles do see the Bookmarked tab. Its empty state — `${name} hasn't bookmarked anything yet` — is fine, but a first-time visitor won't realise the *default* is public. Add a small "public" indicator (or "private" pin on your own profile if you've toggled it off) so viewers can calibrate what they're seeing.

#### P3. Notification bell dot is fixed 12 px red circle, no count
`src/app/components/AppShell.tsx:352-358`

The dot signals unread but not scale. A subtle count ("3", "9+") would help users decide whether to open the dropdown now vs. after their current task. Standard bell UX everywhere else.

#### P4. Follow-request notifications count as "unread" but the accept/decline flow reopens the read state weirdly
`src/app/(app)/notifications/page.tsx:110-113` (unconditional mark-all-read) + `AppShell.tsx:218-243` (accept/decline actions from bell)

If a user opens the full page (auto-marks read) then goes back to the bell before the dot recomputes, they may see a fresh dot immediately if a new notif arrived. Fine. But the follow-request-specific rows aren't marked read on the full page (only deleted on accept/decline), so their read state is meaningless. A single "action-pending" state would be less confusing than "read/unread + accept/decline."

#### P5. `groupNotifications` picks the *first* row's actor for the group name — could be stale
`src/lib/notifications.ts:66-89`

For a group of 5 likes, the visible name is whichever like row was fetched first from Supabase. That's not necessarily "most recent" or "most relevant." Preferring the most-recent actor (max `updated_at` inside the group) would feel more current.

#### P6. `people` result set doesn't paginate
`src/app/hooks/useSearch.ts:19, 127` (hard limit 10) + `search/page.tsx:102` (peopleLimit 10)

Only 10 people match a search, ever. On a common name ("Alex", "Chen"), the user can't see beyond page 1. A "Show more" affordance below the last person row would fix this without pagination controls.

#### P7. `recCounts` and `followerCounts` on search rows do one round-trip per query, no batching cache
`src/app/(app)/search/page.tsx:214-233`

Every keystroke that changes the `people` set triggers two more Supabase reads (rec counts + follower counts). Fine at typing pace, but 5-6 queries per keystroke adds up. Debouncing these to fire only after the search settles would halve the traffic.

#### P8. Bell dropdown "No notifications yet" copy is dry
`src/app/components/AppShell.tsx:395-398`

Compare with the full-page empty state (`notifications/page.tsx:301-313`): "Nothing new. When someone likes your recommendations or starts following you, it'll show up here." The full-page copy is warmer. The bell dropdown could reuse it.

#### P9. Bell realtime subscription is per-user but reconnects on tab focus without dedup
`src/app/components/AppShell.tsx:100-114`

Two open tabs → two channels named `notif-bell-{userId}`. Supabase may dedupe internally, but there's a nonzero chance of double-invocation of the `hasUnread` state setter. Rare in practice; worth confirming.

#### P10. "Mark all read" is not offered anywhere
Neither `/notifications` nor the bell dropdown has a "Mark all as read" button. The only ways to clear the dot are (a) navigate to the full page (marks *all* read) or (b) click each preview row individually. A single action would help users who want to intentionally clear the queue without opening the page.

#### P11. Search `?q=` URL param is one-way
`src/app/(app)/search/page.tsx:92, 110-123`

`inputValue` is initialised from `?q=` on first render, then `?q=` mirrors `inputValue` on debounced input. Fine, but the reverse (someone pastes a `/search?q=Dune` URL into the address bar) doesn't sync backwards after mount — the input reflects the URL only once, and if you programmatically update the URL from elsewhere, the input won't follow. Low-severity; only exercised by deep-linkers.

---

## Journey 6 — Dead-ends sweep

Systematic pass across every route, error render, empty state, loading state, and the two settings surfaces.

### Route inventory

Verified 25 pages + 12 route handlers under `src/app`. Every route renders intentional content:

- **Public marketing / auth entry** (`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/about`, `/privacy`, `/terms`, `/contact`) — all render for signed-out visitors. Signed-in users are redirected off `/`, `/login`, `/signup` to `/lobby` by `middleware.ts:66-71`. `/forgot-password` and `/reset-password` are intentionally reachable while signed in.
- **Auth callback** (`/auth/callback`) — route handler only; issues covered in Journeys 1–2.
- **Public rec view** (`/rec/[id]`) — renders for both signed-in and signed-out; issues covered in Journey 2.
- **Redirect-only pages**: `/post` → `/lobby` (`src/app/(app)/post/page.tsx:5-7`, "The standalone /post page was removed"), `/profile` → `/profile/{handle}` or `/lobby` (`src/app/(app)/profile/page.tsx:1-17`).
- **Protected `(app)` routes** (`/lobby`, 5 category feeds, `/collections/[id]`, `/notifications`, `/profile/[handle]`, `/search`, `/settings`) — all bounce signed-out visitors to `/login` via `middleware.ts:79-82`.
- **Global fallbacks**: `not-found.tsx` and `error.tsx` + `global-error.tsx` exist; no blank/unstyled screens found.

No dead route emerged from this sweep beyond the already-flagged Journey 5 B5 (`/profile/@nobody`) and Journey 4 B1 (Restaurants search dead-branch).

### Raw error surfaces (verify + update prior list)

Grep for `error\.message` / `err\.message` renders as UI (excluding `console.error` and dev logging):

| File | Line | What surfaces |
|---|---|---|
| `src/app/login/page.tsx` | 27, 50 | Raw Supabase password / OAuth error |
| `src/app/signup/page.tsx` | 56, 160 | Raw Supabase `auth.signUp` / OAuth error |
| `src/app/components/AuthCard.tsx` | 84, 116, 138 | Raw Supabase signUp / signIn / OAuth error |
| `src/app/reset-password/page.tsx` | 81 | Raw Supabase `updateUser({ password })` error |
| `src/app/components/SettingsPanel.tsx` | 235 | Raw `updateUser({ password })` error in change-password flow |
| `src/app/(app)/lobby/WelcomeOverlay.tsx` | 79 | Raw `profiles.upsert` error while claiming handle |
| `src/app/components/profile/EditProfileModal.tsx` | 51, 69 | `err instanceof Error ? err.message : 'Upload failed'` — Storage / DB errors surfaced verbatim |
| `src/app/components/collections/EditCollectionModal.tsx` | 36 | Raw `collections.update` error |
| `src/app/api/account/delete/route.ts` | 16 | Server returns raw `admin.auth.admin.deleteUser` error, which `SettingsPanel.tsx:862-870` displays as the delete-confirmation error text |
| `src/app/forgot-password/page.tsx` | 26 | Uses **friendly** copy: `'Something went wrong. Please try again in a moment.'` — the good pattern to copy across the others |

**Update to prior list**: the previously-noted seven surfaces are still current. Two additions caught in this pass:
- `EditProfileModal` (avatar upload / save)
- `EditCollectionModal` (collection rename / privacy save)

### Empty states — audit + wording

Verified 12 uses of the shared `EmptyState` component (`src/app/components/EmptyState.tsx`) plus a handful of inline empty states. Warmth judgment for each:

**Warm (keep as-is):**
- Profile own → no posts (`profile/[handle]/page.tsx:1293-1295`): *"Nothing shared yet — You haven't shared any recommendations yet. What's something you've loved lately?"*
- Own → no bookmarks (`:1304-1307`): *"No bookmarks yet — Save recommendations you want to revisit. You can make bookmarks private in Settings."*
- Own → no likes (`:1315-1318`): *"No likes yet — When you ❤️ a recommendation, it'll show up here."*
- Own → no collections (`:1216-1219`): *"No collections yet — Group your recommendations and bookmarks into collections. Tap + New Collection to get started."*
- CategoryFeed → 0 follows (`CategoryFeed.tsx:517-519`): *"You're not following anyone yet — Follow people whose taste you trust. Their recommendations will show up here."*
- CategoryFeed → follows but no posts (`:523-525`): *"Nothing from your people yet — The people you follow haven't recommended anything here yet. Check Discovery to find something worth your time."*
- CategoryFeed → discovery empty, books (`:531`): *"Be the first to recommend a book. What's worth reading?"* (rotates per category — good)
- Notifications page → empty (`notifications/page.tsx:309-311`): *"Nothing new. When someone likes your recommendations or starts following you, it'll show up here."*
- Ignored / blocked users empty (`SettingsPanel.tsx:571-575`, `648-652` similar): *"You haven't ignored anyone."* / *"You haven't blocked anyone."*

**Dry / could be warmer:**
- Bell dropdown → empty (`AppShell.tsx:395-398`): *"No notifications yet"* — already flagged Journey 5 P8; reuse the full-page copy.
- Search → initial state (`search/page.tsx:331-336`): *"Search for recommendations and people"* — static instruction, missing a nudge.
- Profile not found (`:700-707`): *"Profile not found — @{handle} doesn't exist."* — accurate but stranded (Journey 5 B5).
- Rec not found (`rec/[id]/page.tsx:105-111`): *"Recommendation not found — This recommendation may have been removed or the link is invalid."* — decent but dead-ends signed-out users on `/lobby` (Journey 2 B7).

**Third-party-name states (OK but templated):**
- Someone else → no posts (`:1298-1300`): *"Nothing shared yet — ${name} hasn't recommended anything yet."*
- Someone else → no bookmarks (`:1310-1312`): *"Nothing saved yet — ${name} hasn't bookmarked anything yet."*
- Someone else → no likes (`:1321-1323`): *"No likes yet — ${name} hasn't liked anything yet."*
- Someone else → no collections (`:1222-1224`): *"No collections yet — ${name} hasn't created any collections yet."*
- Collection filter yielded 0 (`:1227-1230`): *"No {Category} collections — Try a different category, or create a new collection."*

### Loading states — shared vs. ad-hoc

Shared skeleton components (`src/app/components/skeletons.tsx`): `SkeletonPulse`, `FeedSkeleton`, `ProfileGridSkeleton`, `ProfileSkeleton`, `LobbySkeleton`, `SearchSkeleton`.

**Uses shared correctly:**
- `CategoryFeed.tsx:511` — `<FeedSkeleton />` ✓
- `profile/[handle]/page.tsx:710, 1268` — `<ProfileSkeleton />`, `<ProfileGridSkeleton />` ✓
- `search/page.tsx:327` — `<SearchSkeleton />` ✓
- `notifications/page.tsx:269-272` — composes `<SkeletonPulse>` primitives ✓
- `SearchDropdown.tsx:195-198` — `<SkeletonPulse>` primitives ✓

**Ad-hoc inline `skeleton-pulse` divs (duplicating what `SkeletonPulse` already provides):**
- `profile/[handle]/page.tsx:1183` — collection grid tiles
- `collections/[id]/page.tsx:416-423` — header + grid tiles
- `FollowListModal.tsx:155-158` — row items
- `feed/RecommenderSection.tsx:451-454` — comment rows
- `feed/RecModal.tsx:531-534` — comment rows
- `collections/AddItemsPicker.tsx:192-195` — row items

Seven inline usages of the raw `skeleton-pulse` class instead of the `SkeletonPulse` component. Not broken, but a consistency drift.

**Text-only "Loading…" (no skeleton, no spinner):**
- `/settings` route (`(app)/settings/page.tsx:162-164`)
- Bell dropdown (`AppShell.tsx:391-394`)

Both would benefit from a matching skeleton to feel of-a-piece.

**Feed-spinner (in-viewport pagination):** `CategoryFeed.tsx:559-570`, `profile/[handle]/page.tsx:1351-1362` — consistent style.

### `/settings` — the two-surfaces problem

There are **two distinct settings surfaces** with overlapping (and mismatched) sets of toggles:

1. **`/settings` page** (`src/app/(app)/settings/page.tsx`) — 2 toggles: `notify_bookmarks`, `email_opted_in` + Sign out. Loading state is bare `"Loading…"` text.
2. **`SettingsPanel` overlay** (`src/app/components/SettingsPanel.tsx`) — 6 sections (Account, Notifications, Privacy, Ignored, Blocked, About). Notification section has 4 toggles (`notify_followers`, `notify_likes`, `notify_bookmarks`, `notify_comments`) + email digest + freq selector. No loading state at all (fields just pop in when data arrives).

The `/settings` page is a strict subset of the panel. Both write to the same `profiles` row. Whichever surface the user finds, they get a different mental model of what's tunable. Both toggles for `notify_bookmarks` exist and can be toggled from either — but only the panel version can turn off Followers / Likes / Comments in-app notifications.

**Save feedback audit:**
- `/settings/page.tsx:126-134` — toast on *failure* only (`"Couldn't save that setting."`). No success toast. Users don't know if the toggle stuck.
- `SettingsPanel > NotificationsSection:384-393` — `save()` is `.then(() => {})`. Silent success *and* silent failure. Toggle flips visually, then no confirmation, and if the DB rejected it the next page load will silently revert.
- `SettingsPanel > PrivacySection:465-484` — same pattern. Silent both ways.
- `SettingsPanel > AccountSection` — has success toasts for name / email confirmation / password (`:218, 224, 239`) ✓.

**Email digest opt-in:**
- Default `false` — user must actively opt in ✓.
- Copy on `/settings/page.tsx:177-178`: *"Email digest — Receive a weekly email summary of your notifications."*
- Copy on `SettingsPanel.tsx:415`: same label "Email digest" with weekly/monthly frequency below.
- **No unsubscribe language** appears anywhere in either UI — no *"You can turn this off anytime here"* microcopy, no linked "How to unsubscribe" doc, no acknowledgement that the toggle here *is* the unsubscribe. Digest emails themselves presumably contain an unsubscribe link (not verifiable from repo), but the in-app copy doesn't reassure a user auditing their subscriptions.

---

### BROKEN — a path fails or dead-ends

#### B1. Two settings surfaces with divergent scopes and no cross-link
`src/app/(app)/settings/page.tsx` + `src/app/components/SettingsPanel.tsx`

The `/settings` route offers only 2 toggles + Sign out; `SettingsPanel` offers 4 sections + 6 toggles + Ignored/Blocked/Delete-account/etc. Neither links to the other. A user landing on `/settings` (via a bookmark, muscle memory, or `router.push('/settings')` somewhere in the app) can't discover 90% of their settings. Worse, both write to overlapping columns, so state drift and staleness between the two surfaces is possible if only one is mounted.

#### B2. Privacy + Notification toggles fire-and-forget with no feedback either way
`src/app/components/SettingsPanel.tsx:384-393` (Notifications), `465-484` (Privacy)

Every toggle in these two sections calls `supabase.from('profiles').update(...).then(() => {})`. The result is discarded. Consequences:
- Toggle looks like it saved but silently failed → user assumes it's on, isn't.
- Toggle *did* save → no confirmation → user re-toggles thinking it didn't take.
- No rollback on failure → local state and DB state can drift indefinitely until a full-page reload rehydrates from the DB.

Compare with the `AccountSection` sibling (`:218, 224, 239`) which toasts every save. Fix is a one-line replacement per toggle.

#### B3. `SettingsPanel` change-password still surfaces raw Supabase error text
`src/app/components/SettingsPanel.tsx:235` — `setPwMsg({ text: error.message, ok: false })`

Users updating their password see literal Supabase strings like *"New password should be different from the old password"* or *"Password should be at least 6 characters"* — technically correct, mechanically ugly. The friendly-copy pattern from `forgot-password/page.tsx:26` should be reused (map known error codes to human strings, fall back to a generic apology).

#### B4. Two more raw-error surfaces not in the prior list
- `src/app/components/profile/EditProfileModal.tsx:51, 69` — Storage upload failure and DB save failure both bubble up raw error text via `err instanceof Error ? err.message : 'Upload failed'`.
- `src/app/components/collections/EditCollectionModal.tsx:36` — `setError(updateErr.message)` on collection rename / privacy change.

Add these to the raw-error inventory (previously identified: login, signup, AuthCard, reset-password, SettingsPanel password, WelcomeOverlay, account delete).

---

### CONFUSING — works, but a real person will be lost or see technical text

#### C1. Email digest opt-in has no unsubscribe language anywhere in the UI
`src/app/(app)/settings/page.tsx:177-178`, `src/app/components/SettingsPanel.tsx:415`

The toggle *is* the unsubscribe mechanism — but nothing in the surrounding copy says so. A user who received a digest email and wants to stop them has to intuit that "the toggle that turned them on is also the toggle that turns them off." A single line — *"You can turn this off anytime here"* — beneath the toggle would fix it. Also relevant for GDPR / CAN-SPAM audit if you ever formalise compliance.

#### C2. `/settings` route uses bare "Loading…"; `SettingsPanel` has no loading state at all
`src/app/(app)/settings/page.tsx:162-164` (text) vs. `SettingsPanel.tsx` (nothing — fields materialise into a blank surface).

Both surfaces read from the same `profiles` row. Both should show a matching skeleton (rows of `SkeletonPulse` in the shape of the actual fields) for the ~200 ms it takes to hydrate. Currently the disparity is jarring on cold navigations.

#### C3. Seven inline `skeleton-pulse` divs re-implement `SkeletonPulse`
Files listed in the loading-states audit above.

Not a bug, but every ad-hoc div is one more place where a future refactor of the shimmer animation has to be duplicated. `SkeletonPulse` accepts `style`; the inline divs are literally that same element written by hand. Consolidate on one form.

#### C4. `/settings` route lacks success toast — users don't know it saved
`src/app/(app)/settings/page.tsx:126-134`

Toast fires only on failure. On success, the toggle just… stays flipped. Users on flaky networks re-toggle out of doubt. Adding a `toast('Saved')` on success would remove the doubt. (This is a subset of B2 for the panel side, but the `/settings` route already toasts on failure — so it's a smaller, easier fix.)

#### C5. `/settings` has a Sign Out button; `SettingsPanel` has a Sign Out button; they behave subtly differently
`src/app/(app)/settings/page.tsx:146-150` (`router.push('/login')`) vs. `SettingsPanel.tsx:844-849` (`onClose(); router.push('/login')`).

Same button, two invocations, same-ish result. Not user-visible harm, but the code smell reflects the B1 duplication.

#### C6. `/rec/[id]` and `/profile/[handle]` not-found copy is warm but has no exit
Rec: *"This recommendation may have been removed or the link is invalid."* + "Go to lobby" button (`rec/[id]/page.tsx:105-124`).
Profile: *"@{handle} doesn't exist."* — no button at all (`profile/[handle]/page.tsx:700-707`).

Both should offer at least `/` (landing) as a safe exit for signed-out visitors, and a "Search for someone" / "Explore recommendations" CTA for signed-in ones. Already flagged as Journey 2 B7 and Journey 5 B5 in more detail; noting here because the sweep confirmed no additional not-found handlers exist.

---

### POLISH — minor

#### P1. `/settings` and `SettingsPanel` duplicate the email-digest toggle definition
Any future change to the label, description, or frequency options has to be applied twice. Extract into a shared component.

#### P2. Bell dropdown "No notifications yet" vs. full page "Nothing new. When someone…"
Same event, two vocabularies. Reuse the warmer full-page string. (Also flagged as Journey 5 P8.)

#### P3. Search initial state is a static instruction, not a hook
`src/app/(app)/search/page.tsx:331-336` — *"Search for recommendations and people."* Could suggest trending queries or a "Try searching for a book or restaurant" nudge. Cheap warmth win.

#### P4. Notification opt-in defaults are asymmetric
`SettingsPanel > NotificationsSection:355-362` — all in-app notifications default to `true`, email digest to `false`. Consistent with expectations, but flag for confirmation: if the product philosophy is "quiet by default" (per the landing hero *"No AI. No deep algorithms. No endless scrolling."*), consider defaulting some in-app notifications off too.

#### P5. `/settings` route Loading text is 24 px below the H1 with no other structure
Just visual — the loading indicator floats without context. A row of `SkeletonPulse` in the shape of the toggle rows would feel intentional.

#### P6. `/settings/page.tsx:118-119` and `SettingsPanel.tsx:459-461` both default `bookmarks_private` to `false` in the fallback branch — matches spec but relies on strict-equality check elsewhere
Already covered in Journey 5 C2. Flag again here so the sweep is complete.

---
