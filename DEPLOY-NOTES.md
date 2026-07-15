# Deploy Notes

Pre-deploy requirements and things to verify after a push to production.
Keep this list current — remove items once they're permanently addressed.

## Before deploying

### Run pending Supabase migrations

Any migration under `scripts/migrate-*.sql` needs to run against the
production Supabase project via the SQL editor before the code that
depends on it reaches prod.

- **`scripts/migrate-post-images-bucket.sql`** — required before commit
  `ed369b9` (or any later build that includes the PostModal photo
  upload). The bucket + RLS policies must exist, otherwise new photo
  uploads 400.

## After deploying

### Verify OG share previews on the live URL

`src/app/rec/[id]/opengraph-image.tsx` can't be exercised on localhost
(Slack/Twitter/iMessage fetch the deployed URL). After each deploy that
touches the permalink page or its OG image, share a public rec into a
scratch channel and confirm:

- The card renders with title + author (not the generic fallback)
- A private-profile rec collapses to the generic Notable card

## Environment variables (Vercel)

Prod builds need these set in the Vercel project. Missing keys don't
fail the build — features just quietly stop working.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` — required for auth + all DB access
- `TMDB_API_KEY` — required for movie/TV search
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — required for restaurant location
  features once the search API lands
