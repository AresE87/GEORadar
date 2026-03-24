-- 004: Query templates table
CREATE TABLE query_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_category TEXT NOT NULL CHECK (query_category IN ('brand_direct', 'category_search', 'problem_search', 'comparison')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qt_brand ON query_templates(brand_id);

ALTER TABLE query_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own query templates"
  ON query_templates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = query_templates.brand_id AND brands.user_id = auth.uid()
  ));

-- Auto-generate 8 query templates when a brand is created
CREATE OR REPLACE FUNCTION generate_query_templates()
RETURNS TRIGGER AS $$
DECLARE
  industry_val TEXT;
BEGIN
  industry_val := COALESCE(NEW.industry, 'software');

  INSERT INTO query_templates (brand_id, query_text, query_category) VALUES
    (NEW.id, 'What is ' || NEW.name || '?', 'brand_direct'),
    (NEW.id, 'Tell me about ' || NEW.name, 'brand_direct'),
    (NEW.id, 'Best ' || industry_val || ' tools', 'category_search'),
    (NEW.id, 'Top alternatives to ' || NEW.name, 'comparison'),
    (NEW.id, 'Compare ' || NEW.name || ' vs competitors', 'comparison'),
    (NEW.id, industry_val || ' solutions for businesses', 'category_search'),
    (NEW.id, 'How to solve ' || industry_val || ' challenges', 'problem_search'),
    (NEW.id, 'Is ' || NEW.name || ' worth it?', 'brand_direct');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_brand_created
  AFTER INSERT ON brands
  FOR EACH ROW
  EXECUTE FUNCTION generate_query_templates();
