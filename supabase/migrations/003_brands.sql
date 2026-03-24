-- 003: Brands table
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  description TEXT,
  industry TEXT,
  competitors TEXT[] DEFAULT '{}',
  target_keywords TEXT[] DEFAULT '{}',
  monitoring_active BOOLEAN DEFAULT TRUE,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_brands_user ON brands(user_id);
CREATE INDEX idx_brands_monitoring ON brands(monitoring_active) WHERE monitoring_active = TRUE;

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brands"
  ON brands FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brands"
  ON brands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brands"
  ON brands FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brands"
  ON brands FOR DELETE
  USING (auth.uid() = user_id);
