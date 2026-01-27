-- Fix: Add car_id column to bookings table

-- Step 1: Add car_id column (if it doesn't exist)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS car_id BIGINT;

-- Step 2: Add foreign key constraint (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_car_id_fkey'
    ) THEN
        ALTER TABLE public.bookings 
        ADD CONSTRAINT bookings_car_id_fkey 
        FOREIGN KEY (car_id) REFERENCES public.cars(id);
    END IF;
END $$;

-- Step 3: Grant permissions on bookings table
GRANT ALL ON public.bookings TO anon;
GRANT ALL ON public.bookings TO authenticated;

-- Step 4: Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name = 'car_id';
