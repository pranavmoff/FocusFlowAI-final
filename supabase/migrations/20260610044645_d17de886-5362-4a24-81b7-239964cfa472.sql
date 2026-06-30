
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compute_focusflow_score(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_streak(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_friend_public_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_friend_leaderboard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_friend_requests() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_challenge_progress(uuid,text,date,date) FROM PUBLIC, anon;
