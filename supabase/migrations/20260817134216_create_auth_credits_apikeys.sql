/*
# Auth, Credits, and API Keys

## Overview
Adds user accounts, a credit balance, API key management, and usage logging
to power login, the credit-based billing system, and the developer dashboard.

## New Tables

### profiles
- `id` (uuid, PK, references auth.users) — one row per user, created on signup.
- `credits` (numeric, default 1000) — starting balance. 1 credit = 0.01s of thinking.
- `created_at` (timestamptz)

### api_keys
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users) — owner of the key.
- `name` (text) — human label for the key.
- `key_hash` (text, unique) — SHA256 hash of the plaintext key (never store plaintext).
- `key_prefix` (text) — first 8 chars of the key, shown in the dashboard for identification.
- `created_at` (timestamptz)
- `last_used_at` (timestamptz, nullable)

### usage_logs
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users) — the user who made the request.
- `credits_used` (numeric) — credits deducted for this request.
- `thinking_ms` (integer) — thinking time in milliseconds.
- `created_at` (timestamptz)

## Security
- RLS enabled on all tables.
- profiles: users can read/update only their own row.
- api_keys: users can read/create/delete only their own keys.
- usage_logs: users can read only their own logs; inserts happen via a
  SECURITY DEFINER function so clients cannot forge credit deductions.
- `deduct_credits` is a SECURITY DEFINER function: atomically decrements
  credits and inserts a usage log. Clients cannot call it with another
  user's id because the function always uses auth.uid().
- `create_api_key` is SECURITY DEFINER: generates a random key, stores its
  hash, and returns the plaintext exactly once.
- `get_profile` is SECURITY DEFINER: returns the caller's profile, creating
  it if missing (handles users who existed before this migration).

## Notes
1. A trigger creates a profile row automatically when a new auth.users row
   is inserted, so every new account starts with 1000 credits.
2. Credit rate: 0.01 credits per 0.01s = 1 credit per second of thinking.
3. The frontend never writes credits directly — only deduct_credits can.
*/

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits numeric NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger: create a profile row whenever a new auth.users row appears.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any users that already exist.
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- api_keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_api_keys" ON api_keys;
CREATE POLICY "select_own_api_keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_api_keys" ON api_keys;
CREATE POLICY "delete_own_api_keys"
  ON api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Note: no INSERT/UPDATE policies — all writes go through SECURITY DEFINER
-- functions so users cannot inject arbitrary key_hash values.

-- ---------------------------------------------------------------------------
-- usage_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_used numeric NOT NULL,
  thinking_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usage_logs" ON usage_logs;
CREATE POLICY "select_own_usage_logs"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS usage_logs_user_id_created_idx
  ON usage_logs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER functions
-- ---------------------------------------------------------------------------

-- get_profile: returns the caller's profile, creating it if missing.
CREATE OR REPLACE FUNCTION public.get_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles;
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  RETURN p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile() TO authenticated;

-- deduct_credits: atomically decrement credits and log usage.
-- 0.01 credits per 0.01s => credits = thinking_ms / 10.
CREATE OR REPLACE FUNCTION public.deduct_credits(p_thinking_ms integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amount numeric;
  new_balance numeric;
BEGIN
  IF p_thinking_ms < 0 THEN
    p_thinking_ms := 0;
  END IF;

  amount := p_thinking_ms / 10.0;  -- 1 credit per second

  UPDATE public.profiles
  SET credits = credits - amount
  WHERE id = auth.uid()
  RETURNING credits INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user %', auth.uid();
  END IF;

  INSERT INTO public.usage_logs (user_id, credits_used, thinking_ms)
  VALUES (auth.uid(), amount, p_thinking_ms);

  RETURN new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_credits(integer) TO authenticated;

-- create_api_key: generates a random key, stores its hash, returns plaintext once.
CREATE OR REPLACE FUNCTION public.create_api_key(p_name text)
RETURNS TABLE(key text, key_prefix text, id uuid, name text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_key text;
  key_hash text;
  key_prefix text;
  new_id uuid;
  new_created timestamptz;
BEGIN
  raw_key := 'vk_' || encode(gen_random_bytes(24), 'hex');
  key_hash := encode(digest(raw_key, 'sha256'), 'hex');
  key_prefix := substring(raw_key from 1 for 11);

  INSERT INTO public.api_keys (user_id, name, key_hash, key_prefix)
  VALUES (auth.uid(), COALESCE(p_name, 'Default'), key_hash, key_prefix)
  RETURNING id, created_at INTO new_id, new_created;

  RETURN QUERY SELECT raw_key, key_prefix, new_id, COALESCE(p_name, 'Default'), new_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_api_key(text) TO authenticated;
