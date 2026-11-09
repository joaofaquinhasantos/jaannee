-- JaanNee AI menu operations: quota accounting, no menu text or photos retained.
-- AI is disabled at the application layer until an authorized paid tier and
-- AI_GATEWAY_API_KEY + ENABLE_RESTAURANT_AI are configured on the server.
BEGIN;

CREATE TABLE public.restaurant_ai_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.restaurant_businesses(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('import', 'translate')),
  source_type text NOT NULL DEFAULT 'text' CHECK (source_type IN ('text','image')),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','succeeded','failed')),
  input_size int NOT NULL CHECK (input_size BETWEEN 1 AND 1000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX restaurant_ai_operations_quota_idx
  ON public.restaurant_ai_operations (business_id, created_at DESC);
ALTER TABLE public.restaurant_ai_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ai_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.restaurant_ai_operations TO authenticated;
GRANT ALL ON public.restaurant_ai_operations TO service_role;

CREATE POLICY "business owner reads own AI usage"
  ON public.restaurant_ai_operations FOR SELECT TO authenticated
  USING (
    owner_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.restaurant_businesses b
      WHERE b.id = business_id AND b.owner_id = (select auth.uid())
    )
  );

-- Service-side RPC reserves a counted slot before requesting a model.
-- Serialized by row lock to prevent overlapping calls exceeding the limit.
-- All 20 monthly attempts count, including failures, to protect API spend.
CREATE FUNCTION public.reserve_restaurant_ai_operation(
  _business_id uuid,
  _owner_id uuid,
  _action text,
  _source_type text,
  _input_size int
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  b public.restaurant_businesses%ROWTYPE;
  used_this_month integer;
  used_this_minute integer;
  operation_id uuid;
BEGIN
  IF _action NOT IN ('import','translate') OR
     _source_type NOT IN ('text','image') OR
     _input_size < 1 OR _input_size > 1000000 THEN
    RAISE EXCEPTION 'Invalid AI operation request';
  END IF;

  SELECT * INTO b FROM public.restaurant_businesses
  WHERE id = _business_id FOR UPDATE;

  IF NOT FOUND OR b.owner_id <> _owner_id THEN
    RAISE EXCEPTION 'Restaurant ownership required';
  END IF;

  IF b.plan_tier NOT IN ('pro','growth') OR
     NOT (
       b.billing_status = 'active' OR
       (b.billing_status = 'trialing' AND b.trial_ends_at > now())
     ) THEN
    RAISE EXCEPTION 'Active Pro or Growth plan required';
  END IF;

  SELECT count(*) INTO used_this_month
    FROM public.restaurant_ai_operations
    WHERE business_id = _business_id
      AND created_at >= date_trunc('month', now())
      AND created_at < date_trunc('month', now()) + interval '1 month';

  IF used_this_month >= 20 THEN
    RAISE EXCEPTION 'Monthly AI menu quota reached';
  END IF;

  SELECT count(*) INTO used_this_minute
    FROM public.restaurant_ai_operations
    WHERE business_id = _business_id
      AND created_at >= now() - interval '1 minute';

  IF used_this_minute >= 2 THEN
    RAISE EXCEPTION 'Please wait before running another AI operation';
  END IF;

  INSERT INTO public.restaurant_ai_operations
    (business_id, owner_id, action, source_type, input_size)
  VALUES (_business_id, _owner_id, _action, _source_type, _input_size)
  RETURNING id INTO operation_id;
  RETURN operation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_restaurant_ai_operation(uuid,uuid,text,text,int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_restaurant_ai_operation(uuid,uuid,text,text,int)
  TO service_role;

CREATE FUNCTION public.finish_restaurant_ai_operation(
  _operation_id uuid, _status text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
BEGIN
  IF _status NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'Invalid AI operation result';
  END IF;
  UPDATE public.restaurant_ai_operations SET
    status = _status,
    finished_at = now()
  WHERE id = _operation_id AND status = 'reserved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI operation not found or already finished';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_restaurant_ai_operation(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_restaurant_ai_operation(uuid,text) TO service_role;

COMMIT;
