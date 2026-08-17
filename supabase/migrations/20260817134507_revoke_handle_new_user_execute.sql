/*
# Lock down handle_new_user trigger function

## Overview
handle_new_user is a trigger function (AFTER INSERT on auth.users) and
should never be called directly via the REST/RPC API. Revoke EXECUTE from
PUBLIC, anon, and authenticated so it can only be invoked by the trigger.

## Notes
- Trigger functions run with the privileges of the invoking trigger's
  owner, so revoking direct EXECUTE does not affect trigger behavior.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
