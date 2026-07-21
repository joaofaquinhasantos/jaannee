CREATE TABLE IF NOT EXISTS public.cuisines (
  slug text PRIMARY KEY,
  name_en text NOT NULL,
  name_th text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cuisines (slug, name_en, name_th) VALUES
  ('thai', 'Thai', 'ไทย'),
  ('italian', 'Italian', 'อิตาเลียน'),
  ('japanese', 'Japanese', 'ญี่ปุ่น'),
  ('western', 'Western', 'ตะวันตก'),
  ('dessert-cafe', 'Dessert & cafe', 'ขนมและคาเฟ่'),
  ('other', 'Other', 'อื่นๆ')
ON CONFLICT (slug) DO NOTHING;

GRANT SELECT ON public.cuisines TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cuisines TO authenticated;
GRANT ALL ON public.cuisines TO service_role;

ALTER TABLE public.cuisines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuisines public read" ON public.cuisines
  FOR SELECT USING (true);

CREATE POLICY "cuisines admin write" ON public.cuisines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.categories
  ADD CONSTRAINT categories_cuisine_fkey
  FOREIGN KEY (cuisine) REFERENCES public.cuisines(slug)
  ON UPDATE CASCADE ON DELETE SET NULL;
