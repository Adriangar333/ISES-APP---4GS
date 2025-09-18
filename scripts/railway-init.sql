-- Railway Database Initialization Script
-- This script will be run automatically when the database is created

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify PostGIS installation
SELECT PostGIS_Version();

-- The rest of the initialization will be handled by the main init.sql file