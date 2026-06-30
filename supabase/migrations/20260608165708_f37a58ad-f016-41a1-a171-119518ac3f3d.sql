
CREATE TYPE public.activity_category AS ENUM ('learning','work','fitness','wellness','entertainment','personal','social','sleep','other');

-- profiles
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

-- activity_dataset (curated, global)
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

-- activity_knowledge_base (self-learning)
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
CREATE POLICY "kb insert" ON public.activity_knowledge_base FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "kb update" ON public.activity_knowledge_base FOR UPDATE TO authenticated USING (true);

-- activities
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
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_activities_user_date ON public.activities(user_id, activity_date DESC);

-- goals
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

-- streaks
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

-- achievements
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

-- ai_insights
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

-- auto-create profile on signup
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
