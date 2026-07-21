-- Admin taxonomy deletes use the authenticated user client.
-- RLS still restricts these operations to admins through the existing
-- "categories admin write" and "areas admin write" policies.
GRANT DELETE ON public.categories TO authenticated;
GRANT DELETE ON public.areas TO authenticated;
