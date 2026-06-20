import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // ── App assets ─────────────────────────────────────────────────────────
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },

      // ── Books ───────────────────────────────────────────────────────────────
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      { protocol: 'https', hostname: '**.ssl-images-amazon.com' }, // images-na.ssl-images-amazon.com
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'i.gr-assets.com' },          // Goodreads
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'https', hostname: 'prodimage.images-bn.com' },   // Barnes & Noble
      { protocol: 'https', hostname: 'images.bookshop.org' },

      // ── Movies & TV ─────────────────────────────────────────────────────────
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'flxt.tmsimg.com' },           // Rotten Tomatoes
      { protocol: 'https', hostname: '**.nflxso.net' },             // Netflix
      { protocol: 'https', hostname: '**.muscache.com' },           // Letterboxd
      { protocol: 'https', hostname: 's.ltrbxd.com' },             // Letterboxd

      // ── Music ───────────────────────────────────────────────────────────────
      { protocol: 'https', hostname: '**.scdn.co' },                // Spotify (i.scdn.co etc.)
      { protocol: 'https', hostname: '**.spotifycdn.com' },         // Spotify oEmbed thumbnails (image-cdn-*.spotifycdn.com)
      { protocol: 'https', hostname: 'i.ytimg.com' },              // YouTube
      { protocol: 'https', hostname: '**.mzstatic.com' },          // Apple Music / TV / Podcasts
      { protocol: 'https', hostname: 'f4.bcbits.com' },            // Bandcamp
      { protocol: 'https', hostname: '**.sndcdn.com' },            // SoundCloud
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' },
      { protocol: 'https', hostname: 'media.pitchfork.com' },
      { protocol: 'https', hostname: 'e-cdns-images.dzcdn.net' }, // Deezer

      // ── Restaurants ─────────────────────────────────────────────────────────
      { protocol: 'https', hostname: '**.googleusercontent.com' }, // Google Maps photos
      { protocol: 'https', hostname: '**.yelpcdn.com' },
      { protocol: 'https', hostname: 'media-cdn.tripadvisor.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: 'img.cdn4dd.com' },           // DoorDash
      { protocol: 'https', hostname: 'images.otstatic.com' },      // OpenTable
      { protocol: 'https', hostname: 'resizer.otstatic.com' },     // OpenTable
      { protocol: 'https', hostname: 'infatuation.imgix.net' },

      // ── Podcasts ────────────────────────────────────────────────────────────
      { protocol: 'https', hostname: 'megaphone.imgix.net' },
      { protocol: 'https', hostname: 'pbcdn1.podbean.com' },
      { protocol: 'https', hostname: 'image.simplecastcdn.com' },
      { protocol: 'https', hostname: 'ssl-static.libsyn.com' },

      // ── General editorial / misc ─────────────────────────────────────────────
      { protocol: 'https', hostname: '**.wikimedia.org' },         // Wikipedia
      { protocol: 'https', hostname: 'static01.nyt.com' },
      { protocol: 'https', hostname: 'i.guim.co.uk' },
      { protocol: 'https', hostname: 'media.timeout.com' },

      // ── Misc that appeared in earlier integrations ───────────────────────────
      { protocol: 'https', hostname: '**.discogs.com' },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  disableLogger: true,
});
