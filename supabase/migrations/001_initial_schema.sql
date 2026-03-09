-- ==========================================
-- GEORadar — Schema Inicial
-- ==========================================

-- Tipos enumerados
CREATE TYPE brand_plan AS ENUM ('free', 'pro', 'agency');
CREATE TYPE query_category AS ENUM ('brand_direct', 'category_search', 'problem_search', 'comparison');
CREATE TYPE llm_provider_enum AS ENUM ('openai', 'anthropic', 'perplexity', 'gemini');
CREATE TYPE mention_type_enum AS ENUM ('primary', 'secondary', 'negative', 'not_mentioned');
CREATE TYPE sentiment_enum AS ENUM ('positive', 'neutral', 'negative', 'not_mentioned');
CREATE TYPE recommendation_type_enum AS ENUM (
  'content_gap', 'citation_opportunity', 'schema_markup',
  'competitor_comparison', 'faq_content', 'definition_page'
);
CREATE TYPE priority_enum AS ENUM ('critical', 'high', 'medium', 'low');

-- ===================
-- TABLA: brands
-- ===================
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  description text,
  industry text,
  competitors text[] DEFAULT '{}',
  target_keywords text[] DEFAULT '{}',
  plan brand_plan DEFAULT 'free',
  monitoring_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_scanned_at timestamptz
);

CREATE INDEX idx_brands_user_id ON brands(user_id);

-- ===================
-- TABLA: query_templates
-- ===================
CREATE TABLE query_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  query_category query_category NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_query_templates_brand_id ON query_templates(brand_id);

-- ===================
-- TABLA: llm_responses
-- ===================
CREATE TABLE llm_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  query_template_id uuid REFERENCES query_templates(id) ON DELETE SET NULL,
  llm_provider llm_provider_enum NOT NULL,
  llm_model text NOT NULL,
  query_text text NOT NULL,
  response_text text NOT NULL,
  brand_mentioned boolean DEFAULT false,
  mention_type mention_type_enum DEFAULT 'not_mentioned',
  mention_position integer,
  sentiment sentiment_enum DEFAULT 'not_mentioned',
  competitors_mentioned text[] DEFAULT '{}',
  response_quality integer CHECK (response_quality BETWEEN 1 AND 10),
  scanned_at timestamptz DEFAULT now()
);

CREATE INDEX idx_llm_responses_brand_id ON llm_responses(brand_id);
CREATE INDEX idx_llm_responses_scanned_at ON llm_responses(scanned_at);
CREATE INDEX idx_llm_responses_provider ON llm_responses(llm_provider);
CREATE INDEX idx_llm_responses_mentioned ON llm_responses(brand_mentioned);

-- ===================
-- TABLA: visibility_scores
-- ===================
CREATE TABLE visibility_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  date date NOT NULL,
  overall_score numeric(5,2) DEFAULT 0,
  mention_rate numeric(5,2) DEFAULT 0,
  primary_rate numeric(5,2) DEFAULT 0,
  sentiment_score numeric(5,2) DEFAULT 0,
  openai_score numeric(5,2) DEFAULT 0,
  anthropic_score numeric(5,2) DEFAULT 0,
  perplexity_score numeric(5,2) DEFAULT 0,
  queries_run integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, date)
);

CREATE INDEX idx_visibility_scores_brand_date ON visibility_scores(brand_id, date);

-- ===================
-- TABLA: recommendations
-- ===================
CREATE TABLE recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  recommendation_type recommendation_type_enum NOT NULL,
  priority priority_enum NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  action_items text[] DEFAULT '{}',
  estimated_impact text,
  is_completed boolean DEFAULT false,
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_recommendations_brand_id ON recommendations(brand_id);

-- ===================
-- TABLA: audit_leads
-- ===================
CREATE TABLE audit_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  domain text,
  brand_name text NOT NULL,
  audit_result jsonb,
  converted_to_user boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ===================
-- RLS (Row Level Security)
-- ===================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_leads ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios solo ven sus propias brands y datos asociados
CREATE POLICY "Users can manage their own brands"
  ON brands FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage query_templates of their brands"
  ON query_templates FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can view responses of their brands"
  ON llm_responses FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can view scores of their brands"
  ON visibility_scores FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage recommendations of their brands"
  ON recommendations FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- audit_leads: inserción pública (el audit tool no requiere auth)
CREATE POLICY "Anyone can insert audit_leads"
  ON audit_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can read audit_leads"
  ON audit_leads FOR SELECT
  USING (auth.role() = 'service_role');

-- ===================
-- VISTA: brand_visibility_summary
-- ===================
CREATE OR REPLACE VIEW brand_visibility_summary AS
SELECT
  b.id AS brand_id,
  b.name AS brand_name,
  b.domain,
  b.plan,
  vs.date,
  vs.overall_score,
  vs.mention_rate,
  vs.primary_rate,
  vs.sentiment_score,
  vs.openai_score,
  vs.anthropic_score,
  vs.perplexity_score,
  vs.queries_run
FROM brands b
LEFT JOIN visibility_scores vs ON vs.brand_id = b.id
WHERE vs.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY vs.date DESC;

-- ===================
-- FUNCIÓN: calculate_geo_score
-- ===================
CREATE OR REPLACE FUNCTION calculate_geo_score(p_brand_id uuid)
RETURNS numeric AS $$
DECLARE
  v_mention_rate numeric;
  v_primary_rate numeric;
  v_sentiment_score numeric;
  v_total integer;
  v_mentioned integer;
  v_primary integer;
  v_positive integer;
  v_neutral integer;
  v_negative integer;
  v_score numeric;
BEGIN
  -- Contar respuestas del día actual
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE brand_mentioned = true),
    COUNT(*) FILTER (WHERE mention_type = 'primary'),
    COUNT(*) FILTER (WHERE sentiment = 'positive'),
    COUNT(*) FILTER (WHERE sentiment = 'neutral'),
    COUNT(*) FILTER (WHERE sentiment = 'negative')
  INTO v_total, v_mentioned, v_primary, v_positive, v_neutral, v_negative
  FROM llm_responses
  WHERE brand_id = p_brand_id
    AND scanned_at::date = CURRENT_DATE;

  -- Evitar división por cero
  IF v_total = 0 THEN
    RETURN 0;
  END IF;

  v_mention_rate := (v_mentioned::numeric / v_total) * 100;
  v_primary_rate := (v_primary::numeric / v_total) * 100;

  -- Sentiment score: positive=100, neutral=50, negative=0
  IF (v_positive + v_neutral + v_negative) > 0 THEN
    v_sentiment_score := ((v_positive * 100 + v_neutral * 50)::numeric /
                          (v_positive + v_neutral + v_negative));
  ELSE
    v_sentiment_score := 50; -- neutral por defecto si no hay menciones con sentimiento
  END IF;

  -- Score compuesto
  v_score := (v_mention_rate * 0.40) + (v_primary_rate * 0.35) + (v_sentiment_score * 0.25);

  -- Upsert del score del día
  INSERT INTO visibility_scores (brand_id, date, overall_score, mention_rate, primary_rate,
    sentiment_score, queries_run)
  VALUES (p_brand_id, CURRENT_DATE, v_score, v_mention_rate, v_primary_rate,
    v_sentiment_score, v_total)
  ON CONFLICT (brand_id, date) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    mention_rate = EXCLUDED.mention_rate,
    primary_rate = EXCLUDED.primary_rate,
    sentiment_score = EXCLUDED.sentiment_score,
    queries_run = EXCLUDED.queries_run;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
