-- SubsBuzz Development Database Initialization
-- Initializes development database with required extensions and settings

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create development-specific settings
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Development user settings (less restrictive than production)
ALTER DATABASE subsbuzz_dev SET timezone = 'UTC';
ALTER DATABASE subsbuzz_dev SET statement_timeout = '30s';
ALTER DATABASE subsbuzz_dev SET lock_timeout = '10s';

-- Enable pg_stat_statements for query analysis in development
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant permissions for development
GRANT ALL PRIVILEGES ON DATABASE subsbuzz_dev TO postgres;

-- Create development-specific schema if needed
-- (Drizzle will handle table creation)

-- Log initialization
SELECT 'SubsBuzz Development Database Initialized' as status;