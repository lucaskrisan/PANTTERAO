UPDATE abandoned_carts
SET email_recovery_sent_at = NULL,
    email_recovery_status = NULL,
    email_reminder_count = 0
WHERE email_recovery_status = 'error'
  AND created_at >= now() - interval '24 hours'
  AND recovered = false
  AND customer_email IS NOT NULL;