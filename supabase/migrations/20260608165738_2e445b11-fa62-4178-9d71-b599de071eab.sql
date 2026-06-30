
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "kb insert" ON public.activity_knowledge_base;
DROP POLICY IF EXISTS "kb update" ON public.activity_knowledge_base;
CREATE POLICY "kb insert" ON public.activity_knowledge_base FOR INSERT TO authenticated
  WITH CHECK (length(activity_name) BETWEEN 1 AND 200 AND score BETWEEN -10 AND 10);
CREATE POLICY "kb update" ON public.activity_knowledge_base FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (length(activity_name) BETWEEN 1 AND 200 AND score BETWEEN -10 AND 10);
