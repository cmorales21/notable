-- Rename table
ALTER TABLE item_clicks RENAME TO item_events;

-- Add type column with default 'click' so existing rows stay valid
ALTER TABLE item_events ADD COLUMN type text NOT NULL DEFAULT 'click';

-- Update indexes (drop old, create new)
DROP INDEX IF EXISTS idx_item_clicks_item;
DROP INDEX IF EXISTS idx_item_clicks_created;
CREATE INDEX idx_item_events_item ON item_events (item_id);
CREATE INDEX idx_item_events_created ON item_events (created_at);
CREATE INDEX idx_item_events_type ON item_events (type);

-- Update RLS policy name
ALTER POLICY "item_clicks_insert_own" ON item_events RENAME TO "item_events_insert_own";

-- Add a composite index for funnel queries
CREATE INDEX idx_item_events_category_type ON item_events (category, type);
