-- Grant Data API access to classifier lookup tables.
-- Without these GRANTs, every PostgREST SELECT silently returns empty for
-- authenticated users, so addActivity always falls through to category='other'.

GRANT SELECT ON public.activity_dataset TO authenticated;
GRANT ALL    ON public.activity_dataset TO service_role;

GRANT SELECT, INSERT ON public.activity_knowledge_base TO authenticated;
GRANT ALL            ON public.activity_knowledge_base TO service_role;

-- Repair any historical rows that were stored as 'other'/0 because of the
-- missing grants, using whatever the knowledge base now knows.
UPDATE public.activities a
SET    category = kb.category,
       score    = kb.score
FROM   public.activity_knowledge_base kb
WHERE  a.category = 'other'
  AND  a.score    = 0
  AND  a.normalized_name = kb.activity_name;