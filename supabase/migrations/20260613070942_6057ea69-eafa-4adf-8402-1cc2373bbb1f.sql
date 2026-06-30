-- Drop triggers first
DROP TRIGGER IF EXISTS friend_connections_notify ON public.friend_connections;

-- Drop social tables (cascade removes dependent FKs/policies)
DROP TABLE IF EXISTS public.friend_challenges CASCADE;
DROP TABLE IF EXISTS public.friend_connections CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.weekly_leagues CASCADE;

-- Drop social functions
DROP FUNCTION IF EXISTS public.are_friends(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.list_friend_requests() CASCADE;
DROP FUNCTION IF EXISTS public.send_friend_request(text) CASCADE;
DROP FUNCTION IF EXISTS public.list_friend_leaderboard() CASCADE;
DROP FUNCTION IF EXISTS public.get_friend_public_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_challenge_progress(uuid, text, date, date) CASCADE;
DROP FUNCTION IF EXISTS public.notify_friend_event() CASCADE;
DROP FUNCTION IF EXISTS public.search_users(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_profile_by_username(text) CASCADE;