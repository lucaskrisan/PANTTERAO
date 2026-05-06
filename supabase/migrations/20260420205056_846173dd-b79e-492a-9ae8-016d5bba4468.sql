SELECT cron.schedule(
  'pixel-token-health-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url:='https://vipltojtcrqatwvzobro.supabase.co/functions/v1/pixel-token-health',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcGx0b2p0Y3JxYXR3dnpvYnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTk4MTAsImV4cCI6MjA4ODY3NTgxMH0.rBq_Vw5aD_hPGpgDoatr2STFkxe_E4fLTX5Hot_MoMU"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'pixel-activity-monitor-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://vipltojtcrqatwvzobro.supabase.co/functions/v1/pixel-activity-monitor',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcGx0b2p0Y3JxYXR3dnpvYnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTk4MTAsImV4cCI6MjA4ODY3NTgxMH0.rBq_Vw5aD_hPGpgDoatr2STFkxe_E4fLTX5Hot_MoMU"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);