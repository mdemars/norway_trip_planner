-- PostgreSQL Permission Grant Script for 'mimir' User
-- Grants permissions to create and manage tables and views on the mimir database public schema
-- 
-- Usage:
--   psql -U postgres -d mimir -f grant_mimir_permissions.sql
--
-- Or run commands manually as superuser:
--   psql -U postgres -d mimir
--   \i grant_mimir_permissions.sql

-- ============================================================================
-- SCHEMA PERMISSIONS
-- ============================================================================

-- Grant usage on public schema (allows user to access schema)
GRANT USAGE ON SCHEMA public TO mimir;

-- Grant create permission on public schema (allows creating tables/views/indexes)
GRANT CREATE ON SCHEMA public TO mimir;


-- ============================================================================
-- TABLE PERMISSIONS
-- ============================================================================

-- Grant all permissions on all existing tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mimir;

-- Grant permissions on all existing sequences (for auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mimir;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mimir;

-- Set default privileges for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mimir;


-- ============================================================================
-- VIEW PERMISSIONS
-- ============================================================================

-- Grant permissions on all existing views
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO mimir;

-- Set default privileges for future views
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON VIEWS TO mimir;


-- ============================================================================
-- FUNCTION/PROCEDURE PERMISSIONS
-- ============================================================================

-- Grant execute permission on all functions (optional but useful)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mimir;

-- Set default privileges for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO mimir;


-- ============================================================================
-- ADDITIONAL USEFUL PERMISSIONS (optional)
-- ============================================================================

-- Uncomment if you need temporary table creation:
-- GRANT TEMP ON DATABASE mimir TO mimir;

-- Uncomment if you need to create indexes:
-- No explicit grant needed - included in CREATE on SCHEMA

-- Uncomment if you need constraint creation:
-- Already included in CREATE on SCHEMA


-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Display the permissions granted
GRANT postgres_to_mimir AS (
  SELECT 
    grantee,
    privilege_type,
    is_grantable,
    table_schema,
    table_name
  FROM information_schema.table_privileges
  WHERE grantee = 'mimir' AND table_schema = 'public'
  ORDER BY table_name, privilege_type
);

-- Show schema permissions
SELECT 
  'Schema Permissions' as permission_type,
  nspname as schema_name,
  array_agg(DISTINCT perm) as permissions
FROM (
  SELECT nspname, 'USAGE' as perm FROM pg_namespace WHERE nspname = 'public'
  UNION ALL
  SELECT nspname, 'CREATE' as perm FROM pg_namespace WHERE nspname = 'public'
) perms
GROUP BY nspname;

-- Confirm completion
\echo ''
\echo '✅ Permissions granted successfully to mimir user!'
\echo 'The mimir user can now:'
\echo '  • Access the public schema (USAGE)'
\echo '  • Create tables, views, and indexes (CREATE)'
\echo '  • Insert, update, delete data (SELECT, INSERT, UPDATE, DELETE)'
\echo '  • Use sequences for auto-increment (USAGE, SELECT on SEQUENCES)'
\echo '  • Execute functions and procedures (EXECUTE)'
\echo ''
