-- Add VIN column to cars table for uniquely identifying each physical car

ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS vin text;

-- Optionally, enforce VIN uniqueness if you want each car to have a unique VIN
-- (Uncomment the line below if you are sure VINs will always be unique)
-- ALTER TABLE public.cars ADD CONSTRAINT cars_vin_unique UNIQUE (vin);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cars' AND column_name = 'vin';

