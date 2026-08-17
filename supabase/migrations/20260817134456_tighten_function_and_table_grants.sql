/*
# Tighten grants on auth/credit tables and functions

## Overview
Revokes default PUBLIC (anon) privileges on profiles, api_keys, usage_logs,
and the three SECURITY DEFINER functions so only authenticated users can
call them. RLS already blocks anon from reading rows, but revoking the
underlying grants removes any path if RLS were ever misconfigured.

## Changes
1. REVOKE ALL on profiles, api_keys, usage_logs from PUBLIC and anon.
2. GRANT SELECT/UPDATE on profiles to authenticated.
3. GRANT SELECT/DELETE on api_keys to authenticated.
4. GRANT SELECT on usage_logs to authenticated.
5. REVOKE EXECUTE on get_profile, deduct_credits, create_api_key from
   PUBLIC and anon; keep GRANT EXECUTE to authenticated only.

## Notes
- The SECURITY DEFINER functions use auth.uid() internally, which is NULL
  for anon, so they would already fail. This just removes the ability to
  invoke them at all.
- Table writes (INSERT on api_keys, INSERT on usage_logs, UPDATE on
  profiles) are intentionally NOT granted to authenticated directly —
  those writes happen only through the SECURITY DEFINER functions.
*/

REVOKE ALL ON public.profiles FROM PUBLIC, anon;
REVOKE ALL ON public.api_keys FROM PUBLIC, anon;
REVOKE ALL ON public.usage_logs FROM PUBLIC, anon;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, DELETE ON public.api_keys TO authenticated;
GRANT SELECT ON public.usage_logs TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_api_key(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_api_key(text) TO authenticated;
