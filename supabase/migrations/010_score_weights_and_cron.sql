-- 010: Score weights and cron jobs
CREATE TABLE score_weights (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mention_weight NUMERIC(3,2) DEFAULT 0.40,
  primary_weight NUMERIC(3,2) DEFAULT 0.35,
  sentiment_weight NUMERIC(3,2) DEFAULT 0.25
);

INSERT INTO score_weights (id) VALUES (1);

-- pg_cron jobs (configure in Supabase dashboard or via SQL)
-- Daily scan at 2 AM UTC
SELECT cron.schedule(
  'daily-scan',
  '0 2 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/daily-scan',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- Daily alerts at 8 AM UTC
SELECT cron.schedule(
  'daily-alerts',
  '0 8 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/daily-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);

-- Cleanup rate limits every hour
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *',
  $$DELETE FROM audit_rate_limits WHERE window_start < NOW() - INTERVAL '2 hours'$$
);

-- Cleanup expired recommendations daily at 3:30 AM
SELECT cron.schedule(
  'cleanup-expired-recs',
  '30 3 * * *',
  $$DELETE FROM recommendations WHERE expires_at < NOW()$$
);
