-- Seed data: Sample properties across the US (idempotent)
-- Uses ON CONFLICT to avoid duplicates on re-run

-- Helper function to insert property idempotently
DO $$
DECLARE
    residential_id INTEGER;
    commercial_id INTEGER;
    industrial_id INTEGER;
    land_id INTEGER;
BEGIN
    -- Get property type IDs
    SELECT id INTO residential_id FROM property_types WHERE name = 'Residential';
    SELECT id INTO commercial_id FROM property_types WHERE name = 'Commercial';
    SELECT id INTO industrial_id FROM property_types WHERE name = 'Industrial';
    SELECT id INTO land_id FROM property_types WHERE name = 'Land';

    -- New York City area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('Empire State Building', '350 5th Ave, New York, NY', commercial_id, 2500000000,
         ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)),
        ('Central Park West Residence', '15 Central Park W, New York, NY', residential_id, 45000000,
         ST_SetSRID(ST_MakePoint(-73.9819, 40.7691), 4326)),
        ('Brooklyn Warehouse', '100 Kent Ave, Brooklyn, NY', industrial_id, 8500000,
         ST_SetSRID(ST_MakePoint(-73.9654, 40.7214), 4326))
    ON CONFLICT DO NOTHING;

    -- San Francisco area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('Salesforce Tower', '415 Mission St, San Francisco, CA', commercial_id, 1100000000,
         ST_SetSRID(ST_MakePoint(-122.3972, 37.7898), 4326)),
        ('Pacific Heights Victorian', '2900 Broadway, San Francisco, CA', residential_id, 12000000,
         ST_SetSRID(ST_MakePoint(-122.4400, 37.7930), 4326)),
        ('Oakland Port Facility', '530 Water St, Oakland, CA', industrial_id, 25000000,
         ST_SetSRID(ST_MakePoint(-122.2789, 37.7956), 4326))
    ON CONFLICT DO NOTHING;

    -- Los Angeles area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('Downtown LA Tower', '633 W 5th St, Los Angeles, CA', commercial_id, 450000000,
         ST_SetSRID(ST_MakePoint(-118.2551, 34.0505), 4326)),
        ('Beverly Hills Estate', '1000 N Roxbury Dr, Beverly Hills, CA', residential_id, 35000000,
         ST_SetSRID(ST_MakePoint(-118.4065, 34.0881), 4326)),
        ('Long Beach Industrial Park', '1500 Pier D St, Long Beach, CA', industrial_id, 18000000,
         ST_SetSRID(ST_MakePoint(-118.2137, 33.7544), 4326))
    ON CONFLICT DO NOTHING;

    -- Chicago area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('Willis Tower', '233 S Wacker Dr, Chicago, IL', commercial_id, 1300000000,
         ST_SetSRID(ST_MakePoint(-87.6359, 41.8789), 4326)),
        ('Lincoln Park Townhouse', '2400 N Lakeview Ave, Chicago, IL', residential_id, 2800000,
         ST_SetSRID(ST_MakePoint(-87.6398, 41.9264), 4326)),
        ('South Side Manufacturing', '3500 S Ashland Ave, Chicago, IL', industrial_id, 5500000,
         ST_SetSRID(ST_MakePoint(-87.6654, 41.8311), 4326))
    ON CONFLICT DO NOTHING;

    -- Denver area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('Republic Plaza', '370 17th St, Denver, CO', commercial_id, 380000000,
         ST_SetSRID(ST_MakePoint(-104.9903, 39.7475), 4326)),
        ('Cherry Creek Home', '100 S Cherry St, Denver, CO', residential_id, 1500000,
         ST_SetSRID(ST_MakePoint(-104.9536, 39.7171), 4326)),
        ('Mountain Development Land', 'Highway 6, Golden, CO', land_id, 2000000,
         ST_SetSRID(ST_MakePoint(-105.2211, 39.7555), 4326))
    ON CONFLICT DO NOTHING;

    -- Seattle area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('Amazon Spheres', '2101 7th Ave, Seattle, WA', commercial_id, 150000000,
         ST_SetSRID(ST_MakePoint(-122.3384, 47.6157), 4326)),
        ('Queen Anne Victorian', '500 W Highland Dr, Seattle, WA', residential_id, 2200000,
         ST_SetSRID(ST_MakePoint(-122.3629, 47.6311), 4326)),
        ('SODO Warehouse', '2000 1st Ave S, Seattle, WA', industrial_id, 8000000,
         ST_SetSRID(ST_MakePoint(-122.3345, 47.5823), 4326))
    ON CONFLICT DO NOTHING;

    -- Miami area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('Brickell City Centre', '701 S Miami Ave, Miami, FL', commercial_id, 550000000,
         ST_SetSRID(ST_MakePoint(-80.1918, 25.7650), 4326)),
        ('Star Island Mansion', '1 Star Island Dr, Miami Beach, FL', residential_id, 65000000,
         ST_SetSRID(ST_MakePoint(-80.1542, 25.7782), 4326)),
        ('Everglades Development Land', 'US-41, Ochopee, FL', land_id, 500000,
         ST_SetSRID(ST_MakePoint(-81.3031, 25.8975), 4326))
    ON CONFLICT DO NOTHING;

    -- Austin area
    INSERT INTO properties (name, address, property_type_id, value, geometry)
    VALUES
        ('The Austonian', '200 Congress Ave, Austin, TX', commercial_id, 320000000,
         ST_SetSRID(ST_MakePoint(-97.7431, 30.2652), 4326)),
        ('Tarrytown House', '2100 Exposition Blvd, Austin, TX', residential_id, 1800000,
         ST_SetSRID(ST_MakePoint(-97.7735, 30.2945), 4326)),
        ('Tesla Gigafactory Land', 'Harold Green Rd, Austin, TX', industrial_id, 75000000,
         ST_SetSRID(ST_MakePoint(-97.6167, 30.2231), 4326))
    ON CONFLICT DO NOTHING;

END $$;

-- Add some inspections for a few properties
INSERT INTO inspections (property_id, inspection_date, status, notes, inspector_name)
SELECT p.id, '2024-01-15', 'passed', 'Annual safety inspection completed', 'John Smith'
FROM properties p WHERE p.name = 'Empire State Building'
ON CONFLICT DO NOTHING;

INSERT INTO inspections (property_id, inspection_date, status, notes, inspector_name)
SELECT p.id, '2024-02-20', 'passed', 'Fire safety inspection', 'Jane Doe'
FROM properties p WHERE p.name = 'Willis Tower'
ON CONFLICT DO NOTHING;

INSERT INTO inspections (property_id, inspection_date, status, notes, inspector_name)
SELECT p.id, '2024-03-10', 'scheduled', 'Structural assessment pending', 'Bob Johnson'
FROM properties p WHERE p.name = 'Salesforce Tower'
ON CONFLICT DO NOTHING;

-- Track migration
INSERT INTO schema_migrations (version)
VALUES ('006_seed_data')
ON CONFLICT (version) DO NOTHING;
