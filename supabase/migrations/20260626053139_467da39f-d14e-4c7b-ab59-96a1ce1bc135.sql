GRANT EXECUTE ON FUNCTION public.encrypt_note(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_note(bytea, text) TO authenticated;