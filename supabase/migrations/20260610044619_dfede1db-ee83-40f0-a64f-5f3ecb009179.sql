
-- ============= FRIEND CONNECTIONS =============
CREATE TABLE public.friend_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_user_id, receiver_user_id),
  CHECK (sender_user_id <> receiver_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_connections TO authenticated;
GRANT ALL ON public.friend_connections TO service_role;
ALTER TABLE public.friend_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own connections" ON public.friend_connections FOR SELECT TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id);
CREATE POLICY "create as sender" ON public.friend_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_user_id);
CREATE POLICY "update if participant" ON public.friend_connections FOR UPDATE TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id)
  WITH CHECK (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id);
CREATE POLICY "delete own" ON public.friend_connections FOR DELETE TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id);

-- ============= FRIEND CHALLENGES =============
CREATE TABLE public.friend_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_type text NOT NULL CHECK (challenge_type IN ('learning_hours','focusflow_score','focus_streak','deep_work_hours')),
  target_value numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','declined')),
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_challenges TO authenticated;
GRANT ALL ON public.friend_challenges TO service_role;
ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see participant challenges" ON public.friend_challenges FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
CREATE POLICY "create as challenger" ON public.friend_challenges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "update if participant" ON public.friend_challenges FOR UPDATE TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
  WITH CHECK (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- ============= WEEKLY LEAGUES =============
CREATE TABLE public.weekly_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum','diamond')),
  score numeric NOT NULL DEFAULT 0,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_leagues TO authenticated;
GRANT ALL ON public.weekly_leagues TO service_role;
ALTER TABLE public.weekly_leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own league" ON public.weekly_leagues FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= PRODUCTIVITY DNA =============
CREATE TABLE public.productivity_dna (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_profile text NOT NULL DEFAULT 'Balanced Performer',
  description text NOT NULL DEFAULT '',
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  growth_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productivity_dna TO authenticated;
GRANT ALL ON public.productivity_dna TO service_role;
ALTER TABLE public.productivity_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dna" ON public.productivity_dna FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.dna_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  profile text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dna_history TO authenticated;
GRANT ALL ON public.dna_history TO service_role;
ALTER TABLE public.dna_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dna history" ON public.dna_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= LIFE STORIES =============
CREATE TABLE public.life_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('weekly','monthly','yearly')),
  period_key text NOT NULL,
  narrative text NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_type, period_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_stories TO authenticated;
GRANT ALL ON public.life_stories TO service_role;
ALTER TABLE public.life_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stories" ON public.life_stories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= HELPER FUNCTIONS =============
CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friend_connections
    WHERE status='accepted'
      AND ((sender_user_id=a AND receiver_user_id=b) OR (sender_user_id=b AND receiver_user_id=a))
  )
$$;

-- compute focusflow score over last 7 days for one user (server-side; bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.compute_focusflow_score(target uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_min numeric;
  weighted_pos numeric;
  weighted_neg numeric;
  productive_min numeric;
  focus_min numeric;
  distract_min numeric;
  wellness_min numeric;
  days_with_productive int;
  productivity numeric; consistency numeric; focus numeric; wellness numeric; distraction numeric;
  base numeric;
BEGIN
  SELECT
    COALESCE(SUM(duration_minutes),0),
    COALESCE(SUM(CASE WHEN score>0 THEN duration_minutes*(score::numeric/10) END),0),
    COALESCE(SUM(CASE WHEN score<0 THEN duration_minutes*(abs(score)::numeric/10) END),0),
    COALESCE(SUM(CASE WHEN category IN ('learning','work') AND score>0 THEN duration_minutes END),0),
    COALESCE(SUM(CASE WHEN category IN ('learning','work') AND score>=7 THEN duration_minutes END),0),
    COALESCE(SUM(CASE WHEN score<=-2 THEN duration_minutes END),0),
    COALESCE(SUM(CASE WHEN category IN ('fitness','wellness') THEN duration_minutes END),0)
  INTO total_min, weighted_pos, weighted_neg, productive_min, focus_min, distract_min, wellness_min
  FROM public.activities WHERE user_id=target AND activity_date >= CURRENT_DATE - INTERVAL '7 days';

  SELECT COUNT(DISTINCT activity_date) INTO days_with_productive
  FROM public.activities WHERE user_id=target AND activity_date >= CURRENT_DATE - INTERVAL '7 days' AND score>=5;

  productivity := GREATEST(0, LEAST(100, ((weighted_pos - 0.5*weighted_neg) / GREATEST(total_min,60))*100 + 25));
  consistency := LEAST(100, (days_with_productive::numeric/7)*100);
  focus := LEAST(100, (focus_min / GREATEST(productive_min+distract_min,60))*100 + LEAST(focus_min/30,25));
  wellness := LEAST(100, (wellness_min/(7*60))*100);
  distraction := LEAST(100, (distract_min/(7*60))*100);
  base := 0.4*productivity + 0.3*consistency + 0.2*focus + 0.1*wellness;
  RETURN ROUND(GREATEST(0, LEAST(100, base - distraction*0.15)));
END $$;

-- current daily streak (consecutive days back from today with score>=5 activity)
CREATE OR REPLACE FUNCTION public.current_streak(target uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s integer := 0;
  d date := CURRENT_DATE;
BEGIN
  LOOP
    IF EXISTS (SELECT 1 FROM public.activities WHERE user_id=target AND activity_date=d AND score>=5) THEN
      s := s+1; d := d - 1;
    ELSE
      EXIT;
    END IF;
    IF s>365 THEN EXIT; END IF;
  END LOOP;
  RETURN s;
END $$;

-- send friend request by email
CREATE OR REPLACE FUNCTION public.send_friend_request(target_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_id uuid;
  me uuid := auth.uid();
  existing record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id INTO target_id FROM auth.users WHERE lower(email)=lower(trim(target_email)) LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'No FocusFlow user found with that email'; END IF;
  IF target_id = me THEN RAISE EXCEPTION 'You can''t add yourself'; END IF;

  SELECT * INTO existing FROM public.friend_connections
   WHERE (sender_user_id=me AND receiver_user_id=target_id)
      OR (sender_user_id=target_id AND receiver_user_id=me)
   LIMIT 1;
  IF FOUND THEN
    IF existing.status='accepted' THEN RETURN jsonb_build_object('status','already_friends'); END IF;
    IF existing.status='pending' THEN
      IF existing.receiver_user_id=me THEN
        UPDATE public.friend_connections SET status='accepted' WHERE id=existing.id;
        RETURN jsonb_build_object('status','accepted');
      END IF;
      RETURN jsonb_build_object('status','already_pending');
    END IF;
    -- rejected → resend
    UPDATE public.friend_connections SET status='pending', sender_user_id=me, receiver_user_id=target_id WHERE id=existing.id;
    RETURN jsonb_build_object('status','resent');
  END IF;

  INSERT INTO public.friend_connections(sender_user_id, receiver_user_id) VALUES (me, target_id);
  RETURN jsonb_build_object('status','sent');
END $$;

-- public stats visible to friends (and self)
CREATE OR REPLACE FUNCTION public.get_friend_public_stats(target uuid)
RETURNS TABLE(user_id uuid, display_name text, dna_profile text, focusflow_score numeric, current_streak integer, achievements_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF me<>target AND NOT public.are_friends(me,target) THEN RAISE EXCEPTION 'not friends'; END IF;
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(trim(p.full_name),''),'User'),
    COALESCE(d.primary_profile, p.persona, 'Balanced Performer'),
    public.compute_focusflow_score(p.id),
    public.current_streak(p.id),
    COALESCE((SELECT COUNT(*)::int FROM public.achievements WHERE user_id=p.id),0)
  FROM public.profiles p
  LEFT JOIN public.productivity_dna d ON d.user_id=p.id
  WHERE p.id=target;
END $$;

-- leaderboard across me + all accepted friends
CREATE OR REPLACE FUNCTION public.list_friend_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, dna_profile text, focusflow_score numeric, current_streak integer, achievements_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  RETURN QUERY
  WITH ids AS (
    SELECT me AS uid
    UNION
    SELECT CASE WHEN sender_user_id=me THEN receiver_user_id ELSE sender_user_id END
      FROM public.friend_connections WHERE status='accepted' AND (sender_user_id=me OR receiver_user_id=me)
  )
  SELECT
    p.id,
    COALESCE(NULLIF(trim(p.full_name),''),'User'),
    COALESCE(d.primary_profile, p.persona, 'Balanced Performer'),
    public.compute_focusflow_score(p.id),
    public.current_streak(p.id),
    COALESCE((SELECT COUNT(*)::int FROM public.achievements WHERE user_id=p.id),0)
  FROM ids i
  JOIN public.profiles p ON p.id=i.uid
  LEFT JOIN public.productivity_dna d ON d.user_id=p.id
  ORDER BY public.compute_focusflow_score(p.id) DESC NULLS LAST;
END $$;

-- pending incoming requests with sender names
CREATE OR REPLACE FUNCTION public.list_friend_requests()
RETURNS TABLE(id uuid, sender_id uuid, sender_name text, status text, direction text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  RETURN QUERY
  SELECT fc.id, fc.sender_user_id,
         COALESCE(NULLIF(trim(p.full_name),''),'User'),
         fc.status,
         CASE WHEN fc.sender_user_id=me THEN 'outgoing' ELSE 'incoming' END,
         fc.created_at
  FROM public.friend_connections fc
  JOIN public.profiles p ON p.id = CASE WHEN fc.sender_user_id=me THEN fc.receiver_user_id ELSE fc.sender_user_id END
  WHERE (fc.sender_user_id=me OR fc.receiver_user_id=me) AND fc.status='pending'
  ORDER BY fc.created_at DESC;
END $$;

-- challenge progress (hours/score for a user between two dates) — only if they are friends/self
CREATE OR REPLACE FUNCTION public.get_challenge_progress(target uuid, kind text, start_d date, end_d date)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); v numeric;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF me<>target AND NOT public.are_friends(me,target) THEN RAISE EXCEPTION 'not friends'; END IF;
  IF kind='learning_hours' THEN
    SELECT COALESCE(SUM(duration_minutes),0)/60.0 INTO v FROM public.activities
      WHERE user_id=target AND category='learning' AND activity_date BETWEEN start_d AND end_d;
  ELSIF kind='deep_work_hours' THEN
    SELECT COALESCE(SUM(duration_minutes),0)/60.0 INTO v FROM public.activities
      WHERE user_id=target AND category='work' AND score>=7 AND activity_date BETWEEN start_d AND end_d;
  ELSIF kind='focus_streak' THEN
    v := public.current_streak(target);
  ELSE
    v := public.compute_focusflow_score(target);
  END IF;
  RETURN COALESCE(v,0);
END $$;

GRANT EXECUTE ON FUNCTION public.are_friends(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_focusflow_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_streak(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_public_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_progress(uuid,text,date,date) TO authenticated;
