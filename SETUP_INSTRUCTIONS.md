# Car Booking System - Setup Instructions

## ✅ What Has Been Implemented

1. **Frontend Updates:**
   - Replaced manual car selection fields with a single "Select Car" dropdown
   - Added car availability checking in the schedule modal
   - Booked time slots are now shown as disabled/red in the calendar
   - Added conflict checking before booking submission

2. **Backend Integration:**
   - JavaScript fetches cars from Supabase on page load
   - Availability is checked in real-time when car and date are selected
   - Booking submission includes `car_id` to link bookings to specific cars

## 📋 Steps to Complete Setup

### Step 1: Run SQL in Supabase

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase_setup.sql` in this folder
4. Copy the entire SQL script
5. Paste it into the SQL Editor
6. Click **Run** to execute

This will:
- Create the `cars` table
- Insert 6 sample cars (Hyundai Creta, MG Hector, Mercedes C-Class, Toyota Fortuner, Hyundai Venue, MG Astor)
- Add `car_id` column to `bookings` table
- Set up RLS policies for both tables

### Step 2: Verify Tables

1. Go to **Table Editor** in Supabase
2. Check that you have:
   - `cars` table with 6 rows
   - `bookings` table with a `car_id` column

### Step 3: Test the Flow

1. Open `index.html` in your browser
2. Fill out the form:
   - Select a car from the dropdown (should show 6 cars)
   - Fill other required fields
   - Click "Schedule" button
   - Select a date (Today/Tomorrow/Custom)
   - **Notice**: Time slots should all be enabled (green/white)
   - Select a time slot (e.g., 09:00)
   - Click "Select The Date"
3. Submit the booking
4. **Test Double Booking Prevention:**
   - Open the form again (or refresh)
   - Select the **same car**
   - Click "Schedule"
   - Select the **same date**
   - **Notice**: The time slot you just booked (09:00) should now be **disabled/red** showing "This slot is already booked"
   - Other slots (11:00, 13:00, 15:00) should still be available

## 🎯 Expected Behavior

- **Car Selection**: Dropdown shows all 6 cars with format: "Make Model (Variant) - Year"
- **Availability Check**: When you select a car and date, the calendar checks existing bookings
- **Booked Slots**: Show as red/disabled with tooltip "This slot is already booked"
- **Available Slots**: Show as normal (white/green) and can be selected
- **Conflict Prevention**: If you try to book an already-booked slot, you'll get an alert

## 🔧 Troubleshooting

### Cars not loading?
- Check browser console for errors
- Verify RLS policy `allow_select_cars_for_anon` exists
- Check that `cars` table has data

### Availability not showing?
- Make sure you selected a car first
- Check browser console for API errors
- Verify RLS policy `allow_select_bookings_for_anon` exists

### Booking fails?
- Check that `car_id` column exists in `bookings` table
- Verify RLS policy `allow_insert_for_anon` exists
- Check browser console for specific error messages

## 📝 Sample Cars in Database

1. Hyundai Creta (Petrol) - 2023
2. MG Hector (Petrol) - 2024
3. Mercedes C-Class (Petrol) - 2023
4. Toyota Fortuner (Diesel) - 2024
5. Hyundai Venue (Petrol) - 2024
6. MG Astor (Petrol) - 2023

You can add more cars by inserting rows into the `cars` table in Supabase.
