-- 1) username + avatar columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- enforce format + uniqueness via function-based unique index
CREATE OR REPLACE FUNCTION public.normalize_username(u text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT lower(trim(u)) $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (public.normalize_username(username))
  WHERE username IS NOT NULL;

-- validation trigger
CREATE OR REPLACE FUNCTION public.validate_username() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(trim(NEW.username));
    IF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION 'Username must be 3-20 chars: lowercase letters, numbers, underscore';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_validate_username ON public.profiles;
CREATE TRIGGER profiles_validate_username BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_username();

-- 2) helper: generate unique username from a seed
CREATE OR REPLACE FUNCTION public.generate_unique_username(seed text) RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  base text;
  candidate text;
  i int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(seed,''), '[^a-zA-Z0-9_]', '', 'g'));
  IF length(base) < 3 THEN base := 'user' || base; END IF;
  IF length(base) > 16 THEN base := substring(base, 1, 16); END IF;
  candidate := base;
  WHILE EXISTS(SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    i := i + 1;
    candidate := substring(base,1,16) || i::text;
    IF i > 9999 THEN candidate := base || floor(random()*1000000)::text; EXIT; END IF;
  END LOOP;
  RETURN candidate;
END $$;

-- 3) backfill existing rows
UPDATE public.profiles p
SET username = public.generate_unique_username(
  COALESCE(NULLIF(regexp_replace(lower(p.full_name),'[^a-z0-9_]','','g'),''),
           split_part(u.email,'@',1))
)
FROM auth.users u
WHERE p.id = u.id AND p.username IS NULL;

-- 4) update handle_new_user to auto-generate username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seed text;
  uname text;
  display text;
BEGIN
  display := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  seed := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1), display);
  uname := public.generate_unique_username(seed);
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (NEW.id, display, uname)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

-- 5) availability checker
CREATE OR REPLACE FUNCTION public.is_username_available(candidate text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); norm text;
BEGIN
  norm := lower(trim(candidate));
  IF norm !~ '^[a-z0-9_]{3,20}$' THEN RETURN false; END IF;
  RETURN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = norm AND (me IS NULL OR id <> me));
END $$;

-- 6) update_username with validation
CREATE OR REPLACE FUNCTION public.update_my_username(new_username text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); norm text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  norm := lower(trim(new_username));
  IF norm !~ '^[a-z0-9_]{3,20}$' THEN RAISE EXCEPTION 'Invalid username format'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE username = norm AND id <> me) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;
  UPDATE public.profiles SET username = norm, updated_at = now() WHERE id = me;
  RETURN norm;
END $$;

-- 7) global user search (safe public fields only)
CREATE OR REPLACE FUNCTION public.search_users(q text) RETURNS TABLE(
  user_id uuid, username text, display_name text, avatar_url text, dna_profile text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); needle text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  needle := lower(trim(coalesce(q,'')));
  IF length(needle) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.username,
         COALESCE(NULLIF(trim(p.full_name),''),'User'),
         p.avatar_url,
         COALESCE(d.primary_profile, p.persona, 'Balanced Performer')
  FROM public.profiles p
  LEFT JOIN public.productivity_dna d ON d.user_id = p.id
  WHERE p.id <> me
    AND (lower(p.username) LIKE needle || '%'
         OR lower(p.full_name) LIKE '%' || needle || '%')
  ORDER BY (lower(p.username) = needle) DESC, p.username ASC
  LIMIT 20;
END $$;

-- 8) public profile by username (friends-only stats)
CREATE OR REPLACE FUNCTION public.get_profile_by_username(uname text) RETURNS TABLE(
  user_id uuid, username text, display_name text, avatar_url text, dna_profile text,
  focusflow_score numeric, current_streak int, achievements_count int,
  is_friend boolean, is_self boolean, request_pending boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); target uuid; friends boolean; self_flag boolean; pending boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id INTO target FROM public.profiles WHERE username = lower(trim(uname)) LIMIT 1;
  IF target IS NULL THEN RETURN; END IF;
  self_flag := (target = me);
  friends := public.are_friends(me, target);
  pending := EXISTS(SELECT 1 FROM public.friend_connections
    WHERE status='pending'
      AND ((sender_user_id=me AND receiver_user_id=target) OR (sender_user_id=target AND receiver_user_id=me)));
  RETURN QUERY
  SELECT p.id, p.username,
         COALESCE(NULLIF(trim(p.full_name),''),'User'),
         p.avatar_url,
         COALESCE(d.primary_profile, p.persona, 'Balanced Performer'),
         CASE WHEN self_flag OR friends THEN public.compute_focusflow_score(p.id) ELSE NULL END,
         CASE WHEN self_flag OR friends THEN public.current_streak(p.id) ELSE NULL END,
         CASE WHEN self_flag OR friends THEN COALESCE((SELECT COUNT(*)::int FROM public.achievements WHERE user_id=p.id),0) ELSE NULL END,
         friends, self_flag, pending
  FROM public.profiles p
  LEFT JOIN public.productivity_dna d ON d.user_id = p.id
  WHERE p.id = target;
END $$;

-- 9) update leaderboard rpc to include username + avatar
DROP FUNCTION IF EXISTS public.list_friend_leaderboard();
CREATE OR REPLACE FUNCTION public.list_friend_leaderboard() RETURNS TABLE(
  user_id uuid, username text, display_name text, avatar_url text,
  dna_profile text, focusflow_score numeric, current_streak int, achievements_count int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  RETURN QUERY
  WITH ids AS (
    SELECT me AS uid
    UNION
    SELECT CASE WHEN sender_user_id=me THEN receiver_user_id ELSE sender_user_id END
      FROM public.friend_connections WHERE status='accepted' AND (sender_user_id=me OR receiver_user_id=me)
  )
  SELECT p.id, p.username,
         COALESCE(NULLIF(trim(p.full_name),''),'User'),
         p.avatar_url,
         COALESCE(d.primary_profile, p.persona, 'Balanced Performer'),
         public.compute_focusflow_score(p.id),
         public.current_streak(p.id),
         COALESCE((SELECT COUNT(*)::int FROM public.achievements WHERE user_id=p.id),0)
  FROM ids i
  JOIN public.profiles p ON p.id=i.uid
  LEFT JOIN public.productivity_dna d ON d.user_id=p.id
  ORDER BY public.compute_focusflow_score(p.id) DESC NULLS LAST;
END $$;

-- 10) update list_friend_requests to include username
DROP FUNCTION IF EXISTS public.list_friend_requests();
CREATE OR REPLACE FUNCTION public.list_friend_requests() RETURNS TABLE(
  id uuid, sender_id uuid, sender_name text, sender_username text, sender_avatar text,
  status text, direction text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  RETURN QUERY
  SELECT fc.id, fc.sender_user_id,
         COALESCE(NULLIF(trim(p.full_name),''),'User'),
         p.username, p.avatar_url,
         fc.status,
         CASE WHEN fc.sender_user_id=me THEN 'outgoing' ELSE 'incoming' END,
         fc.created_at
  FROM public.friend_connections fc
  JOIN public.profiles p ON p.id = CASE WHEN fc.sender_user_id=me THEN fc.receiver_user_id ELSE fc.sender_user_id END
  WHERE (fc.sender_user_id=me OR fc.receiver_user_id=me) AND fc.status='pending'
  ORDER BY fc.created_at DESC;
END $$;

-- 11) notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notifications select" ON public.notifications;
CREATE POLICY "own notifications select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own notifications delete" ON public.notifications;
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread ON public.notifications(user_id, read_at, created_at DESC);

-- 12) automatically create notifications on friend request events
CREATE OR REPLACE FUNCTION public.notify_friend_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender_name text; sender_username text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(NULLIF(trim(full_name),''),'Someone'), username INTO sender_name, sender_username
      FROM public.profiles WHERE id = NEW.sender_user_id;
    INSERT INTO public.notifications(user_id, kind, title, body, link)
    VALUES (NEW.receiver_user_id, 'friend_request',
            'New connection request',
            sender_name || ' (@' || COALESCE(sender_username,'user') || ') wants to connect on FocusFlow AI.',
            '/friends');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    SELECT COALESCE(NULLIF(trim(full_name),''),'Someone'), username INTO sender_name, sender_username
      FROM public.profiles WHERE id = NEW.receiver_user_id;
    INSERT INTO public.notifications(user_id, kind, title, body, link)
    VALUES (NEW.sender_user_id, 'friend_accepted',
            'Connection accepted',
            sender_name || ' (@' || COALESCE(sender_username,'user') || ') accepted your connection.',
            '/leaderboard');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS friend_connection_notify ON public.friend_connections;
CREATE TRIGGER friend_connection_notify
AFTER INSERT OR UPDATE ON public.friend_connections
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_event();