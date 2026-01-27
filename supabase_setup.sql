-- Step 1: Create cars table
-- First, drop if exists to ensure clean creation
DROP TABLE IF EXISTS public.cars CASCADE;

CREATE TABLE public.cars (
    id BIGSERIAL PRIMARY KEY,
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_variant TEXT NOT NULL,
    year_of_manufacture TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant necessary permissions
GRANT ALL ON public.cars TO anon;
GRANT ALL ON public.cars TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cars_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.cars_id_seq TO authenticated;

-- Step 2: Insert 6 sample cars (Hyundai, MG, Mercedes, Toyota, and 2 more)
INSERT INTO public.cars (car_make, car_model, car_variant, year_of_manufacture) VALUES
    ('Hyundai', 'Creta', 'Petrol', '2023'),
    ('MG', 'Hector', 'Petrol', '2024'),
    ('Mercedes', 'C-Class', 'Petrol', '2023'),
    ('Toyota', 'Fortuner', 'Diesel', '2024'),
    ('Hyundai', 'Venue', 'Petrol', '2024'),
    ('MG', 'Astor', 'Petrol', '2023')
ON CONFLICT DO NOTHING;

-- Step 3: Add car_id column to bookings table (if it doesn't exist)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS car_id BIGINT REFERENCES public.cars(id);

-- Step 4: Enable RLS on cars table
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Step 5: Create policy to allow SELECT for anon users (so frontend can fetch cars)
DROP POLICY IF EXISTS "allow_select_cars_for_anon" ON public.cars;
CREATE POLICY "allow_select_cars_for_anon"
ON public.cars
AS PERMISSIVE
FOR SELECT
TO anon
USING (true);

-- Step 6: Ensure bookings table has RLS policy for INSERT (if not already created)
-- This should already exist, but adding it here for completeness
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_insert_for_anon" ON public.bookings;
CREATE POLICY "allow_insert_for_anon"
ON public.bookings
AS PERMISSIVE
FOR INSERT
TO anon
WITH CHECK (true);

-- Step 7: Create policy to allow SELECT bookings for anon (to check availability)
DROP POLICY IF EXISTS "allow_select_bookings_for_anon" ON public.bookings;
CREATE POLICY "allow_select_bookings_for_anon"
ON public.bookings
AS PERMISSIVE
FOR SELECT
TO anon
USING (true);

-- Step 8: Refresh PostgREST schema cache (this makes the table visible to REST API)
NOTIFY pgrst, 'reload schema';
