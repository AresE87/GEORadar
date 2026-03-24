-- 005: LLM responses table
CREATE TABLE llm_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  query_template_id UUID NOT NULL REFERENCES query_templates(id) ON DELETE CASCADE,
  scan_date DATE DEFAULT CURRENT_DATE,
  llm_provider TEXT NOT NULL CHECK (llm_provider IN ('openai', 'anthropic', 'perplexity')),
  llm_model TEXT NOT NULL,
  query_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  brand_mentioned BOOLEAN DEFAULT FALSE,
  mention_type TEXT CHECK (mention_type IN ('primary', 'secondary', 'negative', 'not_mentioned')),
  mention_position INTEGER,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  competitors_mentioned TEXT[] DEFAULT '{}',
  response_length INTEGER,
  latency_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_brand_date ON llm_responses(brand_id, scan_date);
CREATE INDEX idx_llm_provider ON llm_responses(llm_provider);
CREATE UNIQUE INDEX idx_llm_unique_scan ON llm_responses(brand_id, query_template_id, llm_provider, scan_date);

ALTER TABLE llm_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own LLM responses"
  ON llm_responses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = llm_responses.brand_id AND brands.user_id = auth.uid()
  ));
