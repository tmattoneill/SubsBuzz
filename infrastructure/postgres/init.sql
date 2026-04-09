-- SubsBuzz Production Database Initialization
-- Enables required extensions; Drizzle ORM handles table creation via migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

ALTER DATABASE subsbuzz SET timezone = 'UTC';
ALTER DATABASE subsbuzz SET statement_timeout = '30s';
ALTER DATABASE subsbuzz SET lock_timeout = '10s';

GRANT ALL PRIVILEGES ON DATABASE subsbuzz TO postgres;
