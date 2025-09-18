-- Create database if it doesn't exist
-- Note: This should be run as a superuser or database owner

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify PostGIS installation
SELECT PostGIS_Version();

-- Create enum types
CREATE TYPE zone_type AS ENUM ('metropolitana', 'rural');
CREATE TYPE route_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE route_point_status AS ENUM ('pending', 'completed', 'skipped');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high');

-- Zones table
CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type zone_type NOT NULL,
    boundaries GEOMETRY(POLYGON, 4326),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for zones
CREATE INDEX IF NOT EXISTS idx_zones_boundaries ON zones USING GIST (boundaries);

-- Inspectors table
CREATE TABLE IF NOT EXISTS inspectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    identification VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    preferred_zones UUID[] DEFAULT '{}',
    max_daily_routes INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Coordinates table
CREATE TABLE IF NOT EXISTS coordinates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    zone_id UUID REFERENCES zones(id),
    imported_from VARCHAR(100),
    point GEOMETRY(POINT, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index for coordinates
CREATE INDEX IF NOT EXISTS idx_coordinates_point ON coordinates USING GIST (point);

-- Trigger to automatically create point geometry from lat/lng
CREATE OR REPLACE FUNCTION update_coordinate_point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_coordinate_point
    BEFORE INSERT OR UPDATE ON coordinates
    FOR EACH ROW
    EXECUTE FUNCTION update_coordinate_point();

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    estimated_duration INTEGER, -- in minutes
    priority priority_level DEFAULT 'medium',
    zone_id UUID REFERENCES zones(id),
    status route_status DEFAULT 'pending',
    assigned_inspector_id UUID REFERENCES inspectors(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Route points table
CREATE TABLE IF NOT EXISTS route_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    coordinate_id UUID REFERENCES coordinates(id),
    point_order INTEGER NOT NULL,
    estimated_time INTEGER, -- in minutes
    status route_point_status DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(route_id, point_order)
);

-- Inspector availability table
CREATE TABLE IF NOT EXISTS inspector_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspector_id UUID REFERENCES inspectors(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inspectors_identification ON inspectors(identification);
CREATE INDEX IF NOT EXISTS idx_inspectors_active ON inspectors(is_active);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_zone ON routes(zone_id);
CREATE INDEX IF NOT EXISTS idx_routes_inspector ON routes(assigned_inspector_id);
CREATE INDEX IF NOT EXISTS idx_route_points_route ON route_points(route_id);
CREATE INDEX IF NOT EXISTS idx_route_points_order ON route_points(route_id, point_order);
CREATE INDEX IF NOT EXISTS idx_availability_inspector ON inspector_availability(inspector_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inspectors_updated_at BEFORE UPDATE ON inspectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();