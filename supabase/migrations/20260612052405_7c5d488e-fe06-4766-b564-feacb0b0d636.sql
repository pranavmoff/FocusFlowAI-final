
-- 1) Fix mutable search_path
ALTER FUNCTION public.normalize_username(text) SET search_path = public;
ALTER FUNCTION public.normalize_username(text) SECURITY INVOKER;

-- 2) Revoke broad EXECUTE on all SECURITY DEFINER public functions
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_focusflow_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_streak(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_challenge_progress(uuid, text, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_friend_public_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profile_by_username(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_username_available(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_friend_leaderboard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_friend_requests() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_friend_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_username(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_username() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_unique_username(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_username(text) FROM PUBLIC, anon, authenticated;

-- 3) Re-grant EXECUTE to authenticated only for RPCs the app calls directly
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_progress(uuid, text, date, date) TO authenticated;

-- 4) Ensure service_role retains access for admin paths
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
