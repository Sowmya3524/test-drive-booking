# Fix: "Could not find the table 'public.cars' in the schema cache"

This error means Supabase's REST API (PostgREST) hasn't refreshed its schema cache yet.

## 🔧 Solution 1: Run Updated SQL (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and run this **complete SQL script**:

```sql
-- Step 1: Drop and recreate table (ensures clean state)
DROP TABLE IF EXISTS public.cars CASCADE;

CREATE TABLE public.cars (
    id BIGSERIAL PRIMARY KEY,
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_variant TEXT NOT NULL,
    year_of_manufacture TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Grant permissions
GRANT ALL ON public.cars TO anon;
GRANT ALL ON public.cars TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cars_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.cars_id_seq TO authenticated;

-- Step 3: Insert 6 sample cars
INSERT INTO public.cars (car_make, car_model, car_variant, year_of_manufacture) VALUES
    ('Hyundai', 'Creta', 'Petrol', '2023'),
    ('MG', 'Hector', 'Petrol', '2024'),
    ('Mercedes', 'C-Class', 'Petrol', '2023'),
    ('Toyota', 'Fortuner', 'Diesel', '2024'),
    ('Hyundai', 'Venue', 'Petrol', '2024'),
    ('MG', 'Astor', 'Petrol', '2023');

-- Step 4: Enable RLS
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Step 5: Create SELECT policy
DROP POLICY IF EXISTS "allow_select_cars_for_anon" ON public.cars;
CREATE POLICY "allow_select_cars_for_anon"
ON public.cars
AS PERMISSIVE
FOR SELECT
TO anon
USING (true);

-- Step 6: Add car_id to bookings (if not exists)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS car_id BIGINT REFERENCES public.cars(id);

-- Step 7: Refresh schema cache (try this)
NOTIFY pgrst, 'reload schema';
```

3. **Wait 10-15 seconds** after running the SQL
4. **Refresh your browser page** (hard refresh: Ctrl+F5)

---

## 🔧 Solution 2: Manual Table Creation (If Solution 1 doesn't work)

### Option A: Create via Table Editor

1. Go to **Table Editor** in Supabase
2. Click **"New Table"**
3. Name: `cars`
4. Add these columns:
   - `id` → Type: `int8` → Primary Key: ✅ → Is Identity: ✅
   - `car_make` → Type: `text` → Nullable: ❌
   - `car_model` → Type: `text` → Nullable: ❌
   - `car_variant` → Type: `text` → Nullable: ❌
   - `year_of_manufacture` → Type: `text` → Nullable: ❌
   - `created_at` → Type: `timestamptz` → Default: `now()`
5. Click **"Save"**
6. Go to **Authentication** → **Policies** → Select `cars` table
7. Click **"New Policy"** → **"For SELECT"**
8. Policy name: `allow_select_cars_for_anon`
9. Allowed operation: `SELECT`
10. Target roles: `anon`
11. USING expression: `true`
12. Click **"Save"**
13. **Wait 10-15 seconds**, then refresh your browser

### Option B: Check Table Schema

1. In **Table Editor**, verify the table shows as `public.cars` (not just `cars`)
2. If it shows a different schema, you may need to move it

---

## 🔧 Solution 3: Force Schema Refresh

Sometimes Supabase needs a moment to refresh. Try:

1. **Wait 30-60 seconds** after creating the table
2. **Restart your Supabase project** (if you have access):
   - Go to **Settings** → **General**
   - Click **"Restart Project"** (if available)
3. **Refresh your browser** (hard refresh: Ctrl+F5)

---

## 🔧 Solution 4: Verify Table Exists

Run this in Supabase **SQL Editor** to verify:

```sql
-- Check if table exists
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'cars';

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cars' AND table_schema = 'public';

-- Check if table has data
SELECT COUNT(*) FROM public.cars;
```

If the first query returns nothing, the table doesn't exist. Run Solution 1.

---

## ✅ After Fixing

1. **Refresh your browser** (Ctrl+F5)
2. **Open browser console** (F12)
3. You should see: `✅ Loaded 6 cars successfully`
4. The dropdown should show all 6 cars

---

## 🆘 Still Not Working?

If you still get the error after trying all solutions:

1. **Check the exact table name** in Supabase Table Editor
2. **Verify it's in `public` schema** (should show as `public.cars`)
3. **Check browser Network tab** (F12 → Network) for the exact API response
4. **Share the error message** from the Network tab response

The most common fix is **Solution 1** - just run the complete SQL script and wait 10-15 seconds before refreshing.
