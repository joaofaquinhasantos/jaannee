
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_en text NOT NULL,
  name_th text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Areas
CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_en text NOT NULL,
  name_th text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.areas TO anon, authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas public read" ON public.areas FOR SELECT USING (true);
CREATE POLICY "areas admin write" ON public.areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Places (restaurants/stalls)
CREATE TABLE public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  address text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.places (area_id);
CREATE INDEX ON public.places (lower(name));
GRANT SELECT ON public.places TO anon, authenticated;
GRANT INSERT ON public.places TO authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places public read" ON public.places FOR SELECT USING (true);
CREATE POLICY "places auth insert" ON public.places FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "places admin write" ON public.places FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Dish status
CREATE TYPE public.dish_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_th text,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  price_thb numeric(10,2),
  photo_url text,
  note text,
  status public.dish_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  elo numeric NOT NULL DEFAULT 1000,
  comparisons_count integer NOT NULL DEFAULT 0,
  needs_update boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.dishes (category_id);
CREATE INDEX ON public.dishes (place_id);
CREATE INDEX ON public.dishes (status);
CREATE INDEX ON public.dishes (lower(name_en));
GRANT SELECT ON public.dishes TO anon, authenticated;
GRANT INSERT, UPDATE ON public.dishes TO authenticated;
GRANT ALL ON public.dishes TO service_role;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dishes public read approved" ON public.dishes FOR SELECT USING (status = 'approved');
CREATE POLICY "dishes owner read" ON public.dishes FOR SELECT TO authenticated USING (auth.uid() = submitted_by);
CREATE POLICY "dishes admin read" ON public.dishes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dishes auth insert" ON public.dishes FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by AND status = 'pending');
CREATE POLICY "dishes admin update" ON public.dishes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dishes admin delete" ON public.dishes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER dishes_updated_at BEFORE UPDATE ON public.dishes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tries
CREATE TABLE public.dish_tries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dish_id)
);
GRANT SELECT, INSERT, DELETE ON public.dish_tries TO authenticated;
GRANT SELECT ON public.dish_tries TO anon;
GRANT ALL ON public.dish_tries TO service_role;
ALTER TABLE public.dish_tries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tries public read" ON public.dish_tries FOR SELECT USING (true);
CREATE POLICY "tries owner write" ON public.dish_tries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tries owner delete" ON public.dish_tries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comparisons: enforce unique unordered pair per user
CREATE TABLE public.comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  dish_lo_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  dish_hi_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  winner_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lo_lt_hi CHECK (dish_lo_id < dish_hi_id),
  UNIQUE (user_id, dish_lo_id, dish_hi_id)
);
CREATE INDEX ON public.comparisons (category_id);
CREATE INDEX ON public.comparisons (user_id);
GRANT SELECT, INSERT, UPDATE ON public.comparisons TO authenticated;
GRANT SELECT ON public.comparisons TO anon;
GRANT ALL ON public.comparisons TO service_role;
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comparisons public read" ON public.comparisons FOR SELECT USING (true);
CREATE POLICY "comparisons owner insert" ON public.comparisons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comparisons owner update" ON public.comparisons FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER comparisons_updated_at BEFORE UPDATE ON public.comparisons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reports
CREATE TYPE public.report_status AS ENUM ('open', 'resolved', 'dismissed');
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  note text,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.reports TO authenticated;
GRANT SELECT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports auth insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports admin read" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reports admin update" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Elo update RPC (SECURITY DEFINER so it can bypass RLS on dishes)
CREATE OR REPLACE FUNCTION public.apply_elo(_a uuid, _b uuid, _winner uuid, _prev_winner uuid, _is_update boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k numeric := 32;
  ea numeric; eb numeric;
  ra numeric; rb numeric;
  sa numeric; sb numeric;
  prev_sa numeric; prev_sb numeric;
BEGIN
  SELECT elo INTO ra FROM dishes WHERE id = _a FOR UPDATE;
  SELECT elo INTO rb FROM dishes WHERE id = _b FOR UPDATE;
  ea := 1 / (1 + power(10, (rb - ra) / 400));
  eb := 1 / (1 + power(10, (ra - rb) / 400));
  sa := CASE WHEN _winner = _a THEN 1 ELSE 0 END;
  sb := 1 - sa;

  IF _is_update THEN
    prev_sa := CASE WHEN _prev_winner = _a THEN 1 ELSE 0 END;
    prev_sb := 1 - prev_sa;
    -- reverse previous, then apply new
    ra := ra - k * (prev_sa - ea) + k * (sa - ea);
    rb := rb - k * (prev_sb - eb) + k * (sb - eb);
    UPDATE dishes SET elo = ra WHERE id = _a;
    UPDATE dishes SET elo = rb WHERE id = _b;
  ELSE
    ra := ra + k * (sa - ea);
    rb := rb + k * (sb - eb);
    UPDATE dishes SET elo = ra, comparisons_count = comparisons_count + 1 WHERE id = _a;
    UPDATE dishes SET elo = rb, comparisons_count = comparisons_count + 1 WHERE id = _b;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_elo(uuid, uuid, uuid, uuid, boolean) TO authenticated, service_role;
