-- Row Level Security for every table in the public schema.
--
-- Why this matters here: the app connects as `postgres`, the table owner, and
-- Postgres exempts a table's owner from RLS — so enabling RLS changes nothing
-- for Prisma. What it does change is the Supabase REST layer. With RLS off,
-- the `anon` and `authenticated` roles that PostgREST authenticates as can read
-- every table, including `users.password_hash`, `users.phone` and the whole
-- `chat_messages` transcript, using nothing but the project's public anon key
-- that ships in the client bundle.
--
-- No policies are created on purpose. Prisma is the only intended consumer and
-- it bypasses RLS as the owner, so deny-by-default is the correct posture: the
-- browser talks to this app, never to PostgREST directly.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
