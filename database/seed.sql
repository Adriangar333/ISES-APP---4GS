-- Seed data for the 11 predefined zones
-- Note: Boundaries are simplified polygons for demonstration purposes
-- In production, these should be replaced with actual geographic boundaries

INSERT INTO zones (name, type, boundaries) VALUES
(
    'Zona I - Metropolitana Suroriente',
    'metropolitana',
    ST_GeomFromText('POLYGON((-74.08 4.58, -74.05 4.58, -74.05 4.62, -74.08 4.62, -74.08 4.58))', 4326)
),
(
    'Zona II - Metropolitana Suroccidente',
    'metropolitana',
    ST_GeomFromText('POLYGON((-74.12 4.58, -74.08 4.58, -74.08 4.62, -74.12 4.62, -74.12 4.58))', 4326)
),
(
    'Zona III - Metropolitana Centro Oriente',
    'metropolitana',
    ST_GeomFromText('POLYGON((-74.08 4.62, -74.05 4.62, -74.05 4.66, -74.08 4.66, -74.08 4.62))', 4326)
),
(
    'Zona IV - Metropolitana Centro Occidente',
    'metropolitana',
    ST_GeomFromText('POLYGON((-74.12 4.62, -74.08 4.62, -74.08 4.66, -74.12 4.66, -74.12 4.62))', 4326)
),
(
    'Zona V - Metropolitana Noroccidente',
    'metropolitana',
    ST_GeomFromText('POLYGON((-74.12 4.66, -74.08 4.66, -74.08 4.70, -74.12 4.70, -74.12 4.66))', 4326)
),
(
    'Zona VI - Metropolitana Nororiente',
    'metropolitana',
    ST_GeomFromText('POLYGON((-74.08 4.66, -74.05 4.66, -74.05 4.70, -74.08 4.70, -74.08 4.66))', 4326)
),
(
    'Zona VII - Rural Oriental Norte',
    'rural',
    ST_GeomFromText('POLYGON((-74.05 4.66, -74.00 4.66, -74.00 4.75, -74.05 4.75, -74.05 4.66))', 4326)
),
(
    'Zona VIII - Rural Occidental Norte',
    'rural',
    ST_GeomFromText('POLYGON((-74.20 4.66, -74.12 4.66, -74.12 4.75, -74.20 4.75, -74.20 4.66))', 4326)
),
(
    'Zona IX - Rural Occidental Sur',
    'rural',
    ST_GeomFromText('POLYGON((-74.20 4.50, -74.12 4.50, -74.12 4.58, -74.20 4.58, -74.20 4.50))', 4326)
),
(
    'Zona X - Rural Oriental Sur',
    'rural',
    ST_GeomFromText('POLYGON((-74.05 4.50, -74.00 4.50, -74.00 4.58, -74.05 4.58, -74.05 4.50))', 4326)
),
(
    'Zona XI - Rural Occidental Centro',
    'rural',
    ST_GeomFromText('POLYGON((-74.20 4.58, -74.12 4.58, -74.12 4.66, -74.20 4.66, -74.20 4.58))', 4326)
);

-- Insert sample inspectors for testing
INSERT INTO inspectors (name, identification, email, phone, preferred_zones, max_daily_routes) VALUES
(
    'Juan Carlos Pérez',
    '12345678',
    'juan.perez@ises.gov.co',
    '+57 300 123 4567',
    (SELECT ARRAY[id] FROM zones WHERE name = 'Zona I - Metropolitana Suroriente'),
    6
),
(
    'María Elena Rodríguez',
    '87654321',
    'maria.rodriguez@ises.gov.co',
    '+57 301 234 5678',
    (SELECT ARRAY[id] FROM zones WHERE name = 'Zona II - Metropolitana Suroccidente'),
    5
),
(
    'Carlos Alberto Gómez',
    '11223344',
    'carlos.gomez@ises.gov.co',
    '+57 302 345 6789',
    (SELECT ARRAY[id] FROM zones WHERE name = 'Zona VII - Rural Oriental Norte'),
    4
);

-- Insert sample availability for inspectors
INSERT INTO inspector_availability (inspector_id, day_of_week, start_time, end_time) 
SELECT 
    i.id,
    generate_series(1, 5) as day_of_week, -- Monday to Friday
    '08:00:00'::TIME,
    '17:00:00'::TIME
FROM inspectors i;

-- Verify the data
SELECT 
    z.name,
    z.type,
    ST_AsText(z.boundaries) as boundaries_wkt
FROM zones z
ORDER BY z.name;

SELECT 
    i.name,
    i.identification,
    i.email,
    (SELECT z.name FROM zones z WHERE z.id = ANY(i.preferred_zones)) as preferred_zone
FROM inspectors i;