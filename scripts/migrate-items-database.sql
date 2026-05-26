-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── Normalized title function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION normalize_title(input text)
RETURNS text AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        unaccent(input),
        '[^a-zA-Z0-9\s]', '', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── items table ──────────────────────────────────────────────────────────────
CREATE TABLE items (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title             text NOT NULL,
  normalized_title  text NOT NULL,
  category          text NOT NULL CHECK (category IN ('books', 'movies', 'music', 'restaurants', 'podcasts')),
  image_url         text,
  author_or_creator text,
  year              integer,
  description       text,
  external_id       text,
  external_source   text,
  outbound_url      text,
  outbound_partner  text,
  outbound_urls     jsonb DEFAULT '{}'::jsonb,
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_items_normalized_title ON items USING gin (normalized_title gin_trgm_ops);
CREATE INDEX idx_items_category         ON items (category);
CREATE INDEX idx_items_external         ON items (external_source, external_id);
CREATE UNIQUE INDEX idx_items_external_unique ON items (external_source, external_id)
  WHERE external_id IS NOT NULL;

-- RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "items_select_all"
  ON items FOR SELECT
  USING (true);

-- Authenticated users can insert
CREATE POLICY "items_insert_authenticated"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── item_clicks table ────────────────────────────────────────────────────────
CREATE TABLE item_clicks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id    uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  partner    text,
  category   text,
  source     text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_item_clicks_item    ON item_clicks (item_id);
CREATE INDEX idx_item_clicks_created ON item_clicks (created_at);

-- RLS
ALTER TABLE item_clicks ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own clicks
CREATE POLICY "item_clicks_insert_own"
  ON item_clicks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── Add item_id to recommendations ──────────────────────────────────────────
ALTER TABLE recommendations ADD COLUMN item_id uuid REFERENCES items(id) ON DELETE SET NULL;
CREATE INDEX idx_recommendations_item ON recommendations (item_id);

-- ─── Search RPC ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_items(
  p_query    text,
  p_category text    DEFAULT NULL,
  p_limit    integer DEFAULT 8
)
RETURNS TABLE (
  id                uuid,
  title             text,
  category          text,
  image_url         text,
  author_or_creator text,
  year              integer,
  outbound_url      text,
  outbound_partner  text,
  external_source   text,
  similarity        real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.category,
    i.image_url,
    i.author_or_creator,
    i.year,
    i.outbound_url,
    i.outbound_partner,
    i.external_source,
    similarity(i.normalized_title, normalize_title(p_query)) AS similarity
  FROM items i
  WHERE
    (p_category IS NULL OR i.category = p_category)
    AND (
      i.normalized_title % normalize_title(p_query)
      OR i.normalized_title ILIKE '%' || normalize_title(p_query) || '%'
    )
  ORDER BY similarity DESC, i.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
