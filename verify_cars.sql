-- Verify cars table has data
SELECT * FROM public.cars ORDER BY car_make, car_model;

-- Count cars
SELECT COUNT(*) as total_cars FROM public.cars;
