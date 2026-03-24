-- 007: Recommendations table
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
    'content_gap', 'citation_opportunity', 'schema_markup',
    'competitor_comparison', 'faq_content', 'definition_page'
  )),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_items TEXT[] DEFAULT '{}',
  estimated_impact TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON recommendations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = recommendations.brand_id AND brands.user_id = auth.uid()
  ));
