-- Create slots table for configurable time slots

CREATE TABLE IF NOT EXISTS public.slots (
    id BIGSERIAL PRIMARY KEY,
    label TEXT NOT NULL,         -- e.g. '09:00 - 12:00'
    time_slot TEXT NOT NULL,     -- underlying value used in bookings, e.g. '09:00-12:00'
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
GRANT ALL ON public.slots TO anon;
GRANT ALL ON public.slots TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.slots_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.slots_id_seq TO authenticated;

-- RLS
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_slots_for_anon" ON public.slots;
CREATE POLICY "allow_select_slots_for_anon"
ON public.slots
AS PERMISSIVE
FOR SELECT
TO anon
USING (is_active = TRUE);

DROP POLICY IF EXISTS "allow_insert_slots_for_anon" ON public.slots;
CREATE POLICY "allow_insert_slots_for_anon"
ON public.slots
AS PERMISSIVE
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "allow_delete_slots_for_anon" ON public.slots;
CREATE POLICY "allow_delete_slots_for_anon"
ON public.slots
AS PERMISSIVE
FOR DELETE
TO anon
USING (true);

-- Seed with default 4 slots if table is empty
INSERT INTO public.slots (label, time_slot, sort_order)
SELECT *
FROM (
    VALUES
        ('09:00 - 11:00', '09:00-11:00', 1),
        ('11:00 - 13:00', '11:00-13:00', 2),
        ('13:00 - 15:00', '13:00-15:00', 3),
        ('15:00 - 17:00', '15:00-17:00', 4)
) AS v(label, time_slot, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.slots);

-- Refresh REST schema
NOTIFY pgrst, 'reload schema';

