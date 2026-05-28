-- Schema auth + stubs de auth.uid()/auth.role() para migraciones public (0003)
-- GoTrue reemplaza estas funciones al arrancar; el schema debe existir antes.
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$ LANGUAGE sql STABLE;
