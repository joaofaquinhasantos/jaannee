-- Explicit deny policies document that customer/payment mapping is never
-- a browser-facing interface. Service role continues bypassing RLS.
CREATE POLICY "billing account data denied to browser" ON public.restaurant_billing_accounts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "billing events denied to browser" ON public.restaurant_billing_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
