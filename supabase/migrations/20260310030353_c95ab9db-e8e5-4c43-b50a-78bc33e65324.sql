-- Fix SECURITY DEFINER view by setting it to SECURITY INVOKER
ALTER VIEW public.active_gateways SET (security_invoker = on);