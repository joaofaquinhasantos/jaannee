-- Admin taxonomy writes use the authenticated user client, so table grants
-- must allow the write operation before RLS can apply the admin-only policy.
GRANT INSERT, UPDATE ON public.categories TO authenticated;
GRANT INSERT, UPDATE ON public.areas TO authenticated;
GRANT INSERT, UPDATE ON public.dish_subtypes TO authenticated;

-- The admin panel also approves/rejects places through the authenticated
-- client. RLS already restricts this to admins via places_update_admin.
GRANT UPDATE ON public.places TO authenticated;
