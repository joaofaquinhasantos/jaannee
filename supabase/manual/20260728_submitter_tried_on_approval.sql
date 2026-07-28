-- JaanNee: a diner submitting a dish implies they have tried it.
-- Run manually in the Supabase SQL editor.
--
-- Posts remain publicly visible while pending. When admin approval makes a
-- dish eligible for comparisons, this trigger atomically adds the submitter's
-- tried mark. Existing approved submissions are backfilled safely.

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_submitter_tried_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND OLD.status IS DISTINCT FROM 'approved'
     AND NEW.submitted_by IS NOT NULL THEN
    INSERT INTO public.dish_tries (user_id, dish_id)
    VALUES (NEW.submitted_by, NEW.id)
    ON CONFLICT (user_id, dish_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_submitter_tried_on_approval()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_submitter_tried_on_approval ON public.dishes;
CREATE TRIGGER trg_mark_submitter_tried_on_approval
AFTER UPDATE OF status ON public.dishes
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
EXECUTE FUNCTION public.mark_submitter_tried_on_approval();

INSERT INTO public.dish_tries (user_id, dish_id)
SELECT d.submitted_by, d.id
FROM public.dishes d
WHERE d.status = 'approved'
  AND d.submitted_by IS NOT NULL
ON CONFLICT (user_id, dish_id) DO NOTHING;

COMMIT;
