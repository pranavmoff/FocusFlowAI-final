
CREATE TYPE public.activity_category AS ENUM ('learning','work','fitness','wellness','entertainment','personal','social','sleep','other');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  persona text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE public.activity_dataset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name text UNIQUE NOT NULL,
  category public.activity_category NOT NULL,
  score int NOT NULL,
  confidence numeric NOT NULL DEFAULT 1.0,
  keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_dataset TO authenticated;
GRANT ALL ON public.activity_dataset TO service_role;
ALTER TABLE public.activity_dataset ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dataset read" ON public.activity_dataset FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_dataset_keywords ON public.activity_dataset USING gin (keywords);

CREATE TABLE public.activity_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name text UNIQUE NOT NULL,
  category public.activity_category NOT NULL,
  score int NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.7,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.activity_knowledge_base TO authenticated;
GRANT ALL ON public.activity_knowledge_base TO service_role;
ALTER TABLE public.activity_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb read" ON public.activity_knowledge_base FOR SELECT TO authenticated USING (true);
CREATE POLICY "kb insert" ON public.activity_knowledge_base FOR INSERT TO authenticated
  WITH CHECK (length(activity_name) BETWEEN 1 AND 200 AND score BETWEEN -10 AND 10);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  category public.activity_category NOT NULL,
  score int NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  activity_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  raw_text text,
  sub_activity text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_activities_user_date ON public.activities(user_id, activity_date DESC);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category public.activity_category,
  target_minutes int NOT NULL CHECK (target_minutes > 0),
  period text NOT NULL DEFAULT 'daily' CHECK (period IN ('daily','weekly')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_type text NOT NULL,
  current_count int NOT NULL DEFAULT 0,
  best_count int NOT NULL DEFAULT 0,
  last_date date,
  UNIQUE(user_id, streak_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streaks TO authenticated;
GRANT ALL ON public.streaks TO service_role;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streaks" ON public.streaks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own achievements" ON public.achievements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insights" ON public.ai_insights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_insights_user ON public.ai_insights(user_id, created_at DESC);

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

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.habit_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  frequency text DEFAULT 'daily',
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.habit_catalog TO authenticated;
GRANT ALL ON public.habit_catalog TO service_role;
ALTER TABLE public.habit_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog readable by authenticated" ON public.habit_catalog FOR SELECT TO authenticated USING (true);

INSERT INTO public.habit_catalog (category, name, description, icon, frequency, sort_order) VALUES
('Learning','Study','Focused study session','BookOpen','daily',1),
('Learning','Reading','Read a book or article','Book','daily',2),
('Learning','Skill Development','Practice a new skill','Sparkles','daily',3),
('Learning','Online Courses','Watch lectures or tutorials','GraduationCap','daily',4),
('Learning','Practice Sessions','Deliberate practice','Target','daily',5),
('Fitness','Gym','Strength training','Dumbbell','daily',6),
('Fitness','Running','Go for a run','Footprints','daily',7),
('Fitness','Walking','Daily walk','PersonStanding','daily',8),
('Fitness','Yoga','Yoga flow','Flower','daily',9),
('Fitness','Stretching','Mobility & stretching','StretchHorizontal','daily',10),
('Health','Drink Water','Stay hydrated','Droplets','daily',11),
('Health','Sleep Early','Sleep before 11pm','Moon','daily',12),
('Health','Healthy Diet','Eat well today','Apple','daily',13),
('Health','Meditation','Mindful meditation','Brain','daily',14),
('Productivity','Deep Work','Distraction free deep work','Focus','daily',15),
('Productivity','Journaling','Daily journal','NotebookPen','daily',16),
('Productivity','Planning','Plan the day','CalendarCheck','daily',17),
('Productivity','Goal Review','Review goals','Goal','daily',18),
('Mindfulness','Gratitude','Note things you''re grateful for','Heart','daily',19),
('Mindfulness','Reflection','End of day reflection','MessageCircle','daily',20),
('Mindfulness','Prayer','Prayer or spiritual practice','Sun','daily',21),
('Mindfulness','Digital Detox','Time away from screens','PowerOff','daily',22);

CREATE TABLE public.user_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES public.habit_catalog(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL,
  icon text,
  description text,
  frequency text DEFAULT 'daily',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_habits TO authenticated;
GRANT ALL ON public.user_habits TO service_role;
ALTER TABLE public.user_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits" ON public.user_habits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_habits_user_idx ON public.user_habits(user_id);

CREATE TABLE public.habit_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_habit_id uuid NOT NULL REFERENCES public.user_habits(id) ON DELETE CASCADE,
  completion_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_habit_id, completion_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_completions TO authenticated;
GRANT ALL ON public.habit_completions TO service_role;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completions" ON public.habit_completions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX habit_completions_user_date_idx ON public.habit_completions(user_id, completion_date);

CREATE TABLE public.emotion_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emotion text NOT NULL,
  note_encrypted bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emotion_entries TO authenticated;
GRANT ALL ON public.emotion_entries TO service_role;
ALTER TABLE public.emotion_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own emotions" ON public.emotion_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX emotion_entries_user_idx ON public.emotion_entries(user_id, created_at DESC);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tasks_user_idx ON public.tasks(user_id, created_at DESC);

CREATE TABLE public.subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtasks TO authenticated;
GRANT ALL ON public.subtasks TO service_role;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subtasks" ON public.subtasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX subtasks_task_idx ON public.subtasks(task_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER user_habits_set_updated BEFORE UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tasks_set_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compute_focusflow_score(target uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_min numeric; weighted_pos numeric; weighted_neg numeric;
  productive_min numeric; focus_min numeric; distract_min numeric; wellness_min numeric;
  days_with_productive int;
  productivity numeric; consistency numeric; focus numeric; wellness numeric; distraction numeric;
  base numeric; habit_bonus numeric;
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

  SELECT LEAST(10, COALESCE(COUNT(*),0)::numeric) INTO habit_bonus
  FROM public.habit_completions WHERE user_id = target AND completion_date >= CURRENT_DATE - INTERVAL '7 days';

  RETURN ROUND(GREATEST(0, LEAST(100, base - distraction*0.15 + habit_bonus)));
END $$;

CREATE OR REPLACE FUNCTION public.current_streak(target uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s integer := 0; d date := CURRENT_DATE;
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

REVOKE EXECUTE ON FUNCTION public.compute_focusflow_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_streak(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

CREATE OR REPLACE FUNCTION public.encrypt_note(plain text, key text)
RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT pgp_sym_encrypt(plain, key)
$$;
CREATE OR REPLACE FUNCTION public.decrypt_note(cipher bytea, key text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT pgp_sym_decrypt(cipher, key)
$$;
REVOKE ALL ON FUNCTION public.encrypt_note(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_note(bytea, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_note(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_note(bytea, text) TO service_role;
