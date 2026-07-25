REVOKE ALL ON FUNCTION public.get_dish_tried_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dish_tried_counts(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.get_follow_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) TO service_role;