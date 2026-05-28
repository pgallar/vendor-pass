-- Grants for GoTrue schema (created on first auth container start)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated;
  END IF;
END
$$;
