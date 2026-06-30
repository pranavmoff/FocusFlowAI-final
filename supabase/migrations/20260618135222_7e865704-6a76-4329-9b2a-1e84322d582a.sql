CREATE OR REPLACE FUNCTION public.compute_focusflow_score(target uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_min numeric; weighted_pos numeric; weighted_neg numeric;
  productive_min numeric; focus_min numeric; distract_min numeric; wellness_min numeric;
  days_with_productive int;
  productivity numeric; consistency numeric; focus numeric; wellness numeric; distraction numeric;
  base numeric; habit_bonus numeric;
  activity_count int;
BEGIN
  SELECT COUNT(*) INTO activity_count
  FROM public.activities WHERE user_id=target AND activity_date >= CURRENT_DATE - INTERVAL '7 days';

  IF activity_count = 0 THEN
    RETURN 0;
  END IF;

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

  IF total_min = 0 THEN
    RETURN 0;
  END IF;

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
END $function$;