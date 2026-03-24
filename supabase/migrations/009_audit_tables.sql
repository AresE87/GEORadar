-- 009: Audit tables (public, no RLS for service_role only)
CREATE TABLE audit_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  brand_name TEXT NOT NULL,
  domain TEXT,
  audit_result JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_rate_limits (
  ip_address INET PRIMARY KEY,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic rate limit check function
CREATE OR REPLACE FUNCTION check_audit_rate_limit(
  p_ip INET,
  p_max INTEGER DEFAULT 20,
  p_window INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT request_count, window_start
  INTO v_count, v_window_start
  FROM audit_rate_limits
  WHERE ip_address = p_ip
  FOR UPDATE;

  -- No record: create new
  IF NOT FOUND THEN
    INSERT INTO audit_rate_limits (ip_address, request_count, window_start)
    VALUES (p_ip, 1, NOW());
    RETURN TRUE;
  END IF;

  -- Window expired: reset
  IF v_window_start < NOW() - (p_window || ' minutes')::INTERVAL THEN
    UPDATE audit_rate_limits
    SET request_count = 1, window_start = NOW()
    WHERE ip_address = p_ip;
    RETURN TRUE;
  END IF;

  -- Over limit
  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  -- Increment
  UPDATE audit_rate_limits
  SET request_count = request_count + 1
  WHERE ip_address = p_ip;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
