-- Reset abandoned carts that failed email sending so the cron can retry them
UPDATE public.abandoned_carts
SET email_recovery_sent_at = NULL,
    email_recovery_status = NULL,
    email_reminder_count = 0
WHERE email_recovery_status = 'error'
  AND recovered = false
  AND customer_email IS NOT NULL;