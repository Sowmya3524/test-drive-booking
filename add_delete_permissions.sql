-- Add DELETE permissions for cars table
-- Run this in Supabase SQL Editor to enable car deletion

-- Step 1: Enable RLS (if not already enabled)
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Step 2: Create DELETE policy for anon users
DROP POLICY IF EXISTS "allow_delete_cars_for_anon" ON public.cars;
CREATE POLICY "allow_delete_cars_for_anon"
ON public.cars
AS PERMISSIVE
FOR DELETE
TO anon
USING (true);

-- Step 3: Also add DELETE policy for bookings table (for "End TD" functionality)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_delete_bookings_for_anon" ON public.bookings;
CREATE POLICY "allow_delete_bookings_for_anon"
ON public.bookings
AS PERMISSIVE
FOR DELETE
TO anon
USING (true);

-- Step 4: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
