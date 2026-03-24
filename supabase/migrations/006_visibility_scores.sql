-- 006: Visibility scores table
CREATE TABLE visibility_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  score_date DATE DEFAULT CURRENT_DATE,
  overall_score NUMERIC(5,2),
  mention_rate NUMERIC(5,2),
  primary_rate NUMERIC(5,2),
  sentiment_score NUMERIC(5,2),
  openai_score NUMERIC(5,2),
  anthropic_score NUMERIC(5,2),
  perplexity_score NUMERIC(5,2),
  total_queries INTEGER,
  total_mentions INTEGER,
  total_primary INTEGER,
  providers_available INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_vs_brand_date ON visibility_scores(brand_id, score_date);

ALTER TABLE visibility_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visibility scores"
  ON visibility_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = visibility_scores.brand_id AND brands.user_id = auth.uid()
  ));
