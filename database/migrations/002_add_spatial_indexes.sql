-- Add spatial indexes for performance optimization
-- This migration adds spatial indexes to improve geospatial query performance

-- Create spatial index on zones boundaries for faster polygon operations
CREATE INDEX IF NOT EXISTS idx_zones_boundaries_gist 
ON zones USING GIST (boundaries);

-- Create spatial index on coordinates for faster point queries
CREATE INDEX IF NOT EXISTS idx_coordinates_point_gist 
ON coordinates USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

-- Create composite index for zone-based coordinate queries
CREATE INDEX IF NOT EXISTS idx_coordinates_zone_id 
ON coordinates (zone_id) WHERE zone_id IS NOT NULL;

-- Create index for active zones to speed up zone lookups
CREATE INDEX IF NOT EXISTS idx_zones_active 
ON zones (is_active) WHERE is_active = true;

-- Create index for zone type filtering
CREATE INDEX IF NOT EXISTS idx_zones_type_active 
ON zones (type, is_active) WHERE is_active = true;

-- Add constraint to ensure zone boundaries are valid polygons
ALTER TABLE zones 
ADD CONSTRAINT check_valid_polygon 
CHECK (ST_IsValid(boundaries));

-- Add constraint to ensure coordinates are within reasonable bounds
ALTER TABLE coordinates 
ADD CONSTRAINT check_latitude_bounds 
CHECK (latitude >= -90 AND latitude <= 90);

ALTER TABLE coordinates 
ADD CONSTRAINT check_longitude_bounds 
CHECK (longitude >= -180 AND longitude <= 180);

-- Create function for efficient zone detection
CREATE OR REPLACE FUNCTION find_zone_for_point(lat DECIMAL, lng DECIMAL)
RETURNS TABLE(zone_id UUID, zone_name VARCHAR, zone_type VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT z.id, z.name, z.type
    FROM zones z
    WHERE z.is_active = true
    AND ST_Contains(z.boundaries, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create function for distance calculation between coordinates
CREATE OR REPLACE FUNCTION calculate_distance_meters(
    lat1 DECIMAL, lng1 DECIMAL, 
    lat2 DECIMAL, lng2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ST_Distance(
        ST_Transform(ST_SetSRID(ST_MakePoint(lng1, lat1), 4326), 3857),
        ST_Transform(ST_SetSRID(ST_MakePoint(lng2, lat2), 4326), 3857)
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to check zone overlaps
CREATE OR REPLACE FUNCTION check_zone_overlap(
    new_boundaries GEOMETRY,
    exclude_zone_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    overlap_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO overlap_count
    FROM zones z
    WHERE z.is_active = true
    AND ST_Overlaps(z.boundaries, new_boundaries)
    AND (exclude_zone_id IS NULL OR z.id != exclude_zone_id);
    
    RETURN overlap_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate polygon geometry
CREATE OR REPLACE FUNCTION validate_polygon_geometry(geom GEOMETRY)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN ST_IsValid(geom) 
        AND ST_GeometryType(geom) = 'ST_Polygon'
        AND ST_Area(geom) > 0;
END;
$$ LANGUAGE plpgsql;

-- Update statistics for better query planning
ANALYZE zones;
ANALYZE coordinates;

-- Add comments for documentation
COMMENT ON INDEX idx_zones_boundaries_gist IS 'Spatial index for zone boundary operations';
COMMENT ON INDEX idx_coordinates_point_gist IS 'Spatial index for coordinate point queries';
COMMENT ON FUNCTION find_zone_for_point IS 'Efficiently find which zone contains a given point';
COMMENT ON FUNCTION calculate_distance_meters IS 'Calculate distance between two points in meters';
COMMENT ON FUNCTION check_zone_overlap IS 'Check if a polygon overlaps with existing zones';
COMMENT ON FUNCTION validate_polygon_geometry IS 'Validate polygon geometry for zones';