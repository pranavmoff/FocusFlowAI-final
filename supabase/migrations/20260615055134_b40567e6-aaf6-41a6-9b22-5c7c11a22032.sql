
-- ============ Extensions ============
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ Activities: structured logging ============
TRUNCATE TABLE public.activities RESTART IDENTITY CASCADE;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS sub_activity text;

-- ============ Habit Catalog (predefined) ============
CREATE TABLE IF NOT EXISTS public.habit_catalog (
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

-- Seed catalog
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
('Mindfulness','Digital Detox','Time away from screens','PowerOff','daily',22)
ON CONFLICT DO NOTHING;

-- ============ User Habits ============
CREATE TABLE IF NOT EXISTS public.user_habits (
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
CREATE INDEX IF NOT EXISTS user_habits_user_idx ON public.user_habits(user_id);

-- ============ Habit Completions ============
CREATE TABLE IF NOT EXISTS public.habit_completions (
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
CREATE INDEX IF NOT EXISTS habit_completions_user_date_idx ON public.habit_completions(user_id, completion_date);

-- ============ Emotion Entries (encrypted notes) ============
CREATE TABLE IF NOT EXISTS public.emotion_entries (
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
CREATE INDEX IF NOT EXISTS emotion_entries_user_idx ON public.emotion_entries(user_id, created_at DESC);

-- ============ Tasks & Subtasks ============
CREATE TABLE IF NOT EXISTS public.tasks (
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
CREATE INDEX IF NOT EXISTS tasks_user_idx ON public.tasks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subtasks (
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
CREATE INDEX IF NOT EXISTS subtasks_task_idx ON public.subtasks(task_id);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS user_habits_set_updated ON public.user_habits;
CREATE TRIGGER user_habits_set_updated BEFORE UPDATE ON public.user_habits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS tasks_set_updated ON public.tasks;
CREATE TRIGGER tasks_set_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Updated focusflow score with habit bonus ============
CREATE OR REPLACE FUNCTION public.compute_focusflow_score(target uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  habit_bonus numeric;
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

  SELECT LEAST(10, COALESCE(COUNT(*),0)::numeric)
  INTO habit_bonus
  FROM public.habit_completions
  WHERE user_id = target AND completion_date >= CURRENT_DATE - INTERVAL '7 days';

  RETURN ROUND(GREATEST(0, LEAST(100, base - distraction*0.15 + habit_bonus)));
END $function$;

-- ============ Encryption helpers (use a server-side key) ============
-- Pass key via parameter; server functions hold the secret.
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
