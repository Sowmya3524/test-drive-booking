-- Remove year_of_manufacture column from cars table
-- This allows customers to provide their own year instead of using the car's default year

-- Step 1: Remove the year_of_manufacture column from cars table
ALTER TABLE public.cars 
DROP COLUMN IF EXISTS year_of_manufacture;

-- Step 2: Verify the column was removed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cars' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Note: The year_of_manufacture field in the bookings table should remain
-- as that's where the customer's selected year is stored
