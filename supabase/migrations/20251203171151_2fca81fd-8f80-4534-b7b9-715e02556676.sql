-- Add coverage boolean columns to claims table
ALTER TABLE public.claims 
ADD COLUMN roadside_assistance boolean DEFAULT true,
ADD COLUMN towing_coverage boolean DEFAULT true,
ADD COLUMN rental_car_coverage boolean DEFAULT true,
ADD COLUMN transport_coverage boolean DEFAULT true;

-- Update all existing claims to have true for all new columns
UPDATE public.claims 
SET roadside_assistance = true,
    towing_coverage = true,
    rental_car_coverage = true,
    transport_coverage = true;