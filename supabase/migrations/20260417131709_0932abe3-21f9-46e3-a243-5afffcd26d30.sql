SELECT cron.schedule(
  'access-link-auto-resend-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://vipltojtcrqatwvzobro.supabase.co/functions/v1/access-link-auto-resend',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcGx0b2p0Y3JxYXR3dnpvYnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTk4MTAsImV4cCI6MjA4ODY3NTgxMH0.rBq_Vw5aD_hPGpgDoatr2STFkxe_E4fLTX5Hot_MoMU"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);