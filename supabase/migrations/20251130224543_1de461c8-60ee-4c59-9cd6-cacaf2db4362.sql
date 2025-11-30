-- Create enum for claim status
CREATE TYPE claim_status AS ENUM (
  'data_gathering',
  'coverage_check',
  'arranging_services',
  'notification_sent',
  'completed'
);

-- Create enum for service types
CREATE TYPE service_type AS ENUM ('tow_truck', 'repair_truck', 'taxi', 'rental_car');

-- Create claims table
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  driver_email TEXT,
  policy_number TEXT NOT NULL,
  location TEXT NOT NULL,
  incident_description TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  status claim_status DEFAULT 'data_gathering',
  is_covered BOOLEAN,
  coverage_details TEXT,
  nearest_garage TEXT,
  arranged_services JSONB DEFAULT '[]'::jsonb,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  service_type service_type NOT NULL,
  provider_name TEXT NOT NULL,
  provider_phone TEXT,
  estimated_arrival INTEGER, -- in minutes
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create policies mock data table
CREATE TABLE insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number TEXT UNIQUE NOT NULL,
  holder_name TEXT NOT NULL,
  holder_phone TEXT NOT NULL,
  holder_email TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  coverage_type TEXT NOT NULL, -- comprehensive, collision, liability
  roadside_assistance BOOLEAN DEFAULT true,
  towing_coverage BOOLEAN DEFAULT true,
  rental_car_coverage BOOLEAN DEFAULT false,
  max_towing_distance INTEGER DEFAULT 50, -- miles
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create garages table
CREATE TABLE garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  services TEXT[] DEFAULT ARRAY['tow', 'repair'],
  average_response_time INTEGER DEFAULT 30, -- minutes
  rating DECIMAL(3,2) DEFAULT 4.5
);

-- Enable RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE garages ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for demo)
CREATE POLICY "Allow public read access to claims" ON claims FOR SELECT USING (true);
CREATE POLICY "Allow public insert on claims" ON claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on claims" ON claims FOR UPDATE USING (true);

CREATE POLICY "Allow public access to services" ON services FOR ALL USING (true);
CREATE POLICY "Allow public access to policies" ON insurance_policies FOR ALL USING (true);
CREATE POLICY "Allow public access to garages" ON garages FOR ALL USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert mock insurance policies
INSERT INTO insurance_policies (policy_number, holder_name, holder_phone, holder_email, vehicle_make, vehicle_model, vehicle_year, coverage_type, roadside_assistance, towing_coverage, rental_car_coverage, max_towing_distance) VALUES
('POL-2024-001', 'John Smith', '+1-555-0101', 'john.smith@email.com', 'Toyota', 'Camry', 2020, 'comprehensive', true, true, true, 100),
('POL-2024-002', 'Sarah Johnson', '+1-555-0102', 'sarah.j@email.com', 'Honda', 'Accord', 2019, 'comprehensive', true, true, false, 75),
('POL-2024-003', 'Michael Brown', '+1-555-0103', 'mbrown@email.com', 'Ford', 'F-150', 2021, 'collision', true, true, true, 50),
('POL-2024-004', 'Emily Davis', '+1-555-0104', 'emily.davis@email.com', 'Tesla', 'Model 3', 2022, 'comprehensive', true, true, true, 100),
('POL-2024-005', 'David Wilson', '+1-555-0105', 'dwilson@email.com', 'Chevrolet', 'Silverado', 2018, 'liability', false, false, false, 0);

-- Insert mock garages
INSERT INTO garages (name, address, phone, latitude, longitude, services, average_response_time, rating) VALUES
('QuickFix Auto Repair', '123 Main St, Downtown', '+1-555-1001', 40.7128, -74.0060, ARRAY['tow', 'repair'], 25, 4.8),
('Reliable Towing Service', '456 Oak Ave, Midtown', '+1-555-1002', 40.7580, -73.9855, ARRAY['tow'], 20, 4.6),
('Premium Auto Care', '789 Pine Rd, Uptown', '+1-555-1003', 40.7831, -73.9712, ARRAY['tow', 'repair'], 35, 4.9),
('24/7 Emergency Tow', '321 Elm St, Suburbs', '+1-555-1004', 40.6892, -73.9442, ARRAY['tow'], 15, 4.7),
('Elite Collision Center', '654 Maple Dr, Industrial', '+1-555-1005', 40.7489, -73.9680, ARRAY['tow', 'repair'], 30, 4.5);