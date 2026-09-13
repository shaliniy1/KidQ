-- StoryWeaver picture books (docs/content-curation/storyweaver.md). Stories and illustrations are
-- released under open licenses (CC BY 4.0 for most); KidQ stores each page's text and references
-- the illustrations on StoryWeaver's servers. Stories without an open license are never stored.
INSERT INTO source_systems (id, name, base_url, connector_version) VALUES
  ('storyweaver', 'StoryWeaver (Pratham Books)', 'https://storyweaver.org.in/api/v1', '1')
ON CONFLICT (id) DO NOTHING;

-- The book as the KidQ reader shows it: { pages: [{ page, text, image_url, image_small_url }], credits }.
ALTER TABLE source_records ADD COLUMN IF NOT EXISTS story jsonb;
