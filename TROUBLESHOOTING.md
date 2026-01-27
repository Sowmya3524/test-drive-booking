# Troubleshooting: Cars Not Loading (404 Error)

## ✅ Checklist - Verify in Supabase

### 1. Check Table Exists
- Go to **Table Editor** in Supabase
- Look for a table named **`cars`** (exact name, lowercase)
- If it's named differently (e.g., `Cars`, `CARS`), rename it to `cars`

### 2. Check Table Schema
- The table must be in the **`public`** schema
- In Table Editor, check the table name shows as `public.cars`
- If it's in a different schema, move it to `public`

### 3. Check RLS Policy
- Go to **Authentication** → **Policies** (or click on the `cars` table → **Policies** tab)
- You should see a policy named: **`allow_select_cars_for_anon`**
- If it doesn't exist, run this SQL:

```sql
CREATE POLICY "allow_select_cars_for_anon"
ON public.cars
AS PERMISSIVE
FOR SELECT
TO anon
USING (true);
```

### 4. Check Table Has Data
- In Table Editor → `cars` table
- You should see 6 rows
- If empty, insert data:

```sql
INSERT INTO public.cars (car_make, car_model, car_variant, year_of_manufacture) VALUES
    ('Hyundai', 'Creta', 'Petrol', '2023'),
    ('MG', 'Hector', 'Petrol', '2024'),
    ('Mercedes', 'C-Class', 'Petrol', '2023'),
    ('Toyota', 'Fortuner', 'Diesel', '2024'),
    ('Hyundai', 'Venue', 'Petrol', '2024'),
    ('MG', 'Astor', 'Petrol', '2023');
```

### 5. Check RLS is Enabled
- In Table Editor → `cars` table
- Look for **Row Level Security** toggle
- It should be **ON** (enabled)
- If OFF, enable it, then create the policy above

### 6. Test API Directly
- Open browser console (F12)
- Run this in the console:

```javascript
fetch('https://iawznkckpbufhprkmufc.supabase.co/rest/v1/cars?select=*', {
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhd3pua2NrcGJ1ZmhwcmttdWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2Mzc0MjMsImV4cCI6MjA4MjIxMzQyM30.ce_cyJC18sL6JLnoEKpe6jBx5UZH6VQSmqnxtDrMaXA',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhd3pua2NrcGJ1ZmhwcmttdWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2Mzc0MjMsImV4cCI6MjA4MjIxMzQyM30.ce_cyJC18sL6JLnoEKpe6jBx5UZH6VQSmqnxtDrMaXA'
    }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

- If this works, the issue is in the frontend code
- If this fails, the issue is in Supabase setup

## 🔧 Quick Fix SQL

Run this complete SQL in Supabase SQL Editor to fix everything:

```sql
-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.cars (
    id BIGSERIAL PRIMARY KEY,
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_variant TEXT NOT NULL,
    year_of_manufacture TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "allow_select_cars_for_anon" ON public.cars;

-- Create SELECT policy
CREATE POLICY "allow_select_cars_for_anon"
ON public.cars
AS PERMISSIVE
FOR SELECT
TO anon
USING (true);

-- Insert cars if table is empty
INSERT INTO public.cars (car_make, car_model, car_variant, year_of_manufacture)
SELECT * FROM (VALUES
    ('Hyundai', 'Creta', 'Petrol', '2023'),
    ('MG', 'Hector', 'Petrol', '2024'),
    ('Mercedes', 'C-Class', 'Petrol', '2023'),
    ('Toyota', 'Fortuner', 'Diesel', '2024'),
    ('Hyundai', 'Venue', 'Petrol', '2024'),
    ('MG', 'Astor', 'Petrol', '2023')
) AS v(car_make, car_model, car_variant, year_of_manufacture)
WHERE NOT EXISTS (SELECT 1 FROM public.cars);
```

## 📝 After Running SQL

1. **Refresh your browser page**
2. **Open browser console (F12)** to see detailed error messages
3. **Check the Network tab** in browser DevTools:
   - Look for the request to `/rest/v1/cars`
   - Check the response status and error message

## 🆘 Still Not Working?

Share with me:
1. The exact error message from browser console (F12 → Console tab)
2. The response from Network tab (F12 → Network → click on the `/rest/v1/cars` request)
3. Screenshot of your Supabase Table Editor showing the `cars` table
