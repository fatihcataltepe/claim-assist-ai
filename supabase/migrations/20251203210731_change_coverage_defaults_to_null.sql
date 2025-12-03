-- Change default values for coverage columns in claims table from true to NULL
ALTER TABLE public.claims 
ALTER COLUMN roadside_assistance DROP DEFAULT,
ALTER COLUMN towing_coverage DROP DEFAULT,
ALTER COLUMN rental_car_coverage DROP DEFAULT,
ALTER COLUMN transport_coverage DROP DEFAULT;

