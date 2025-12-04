-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow public read access to notifications (matching current app behavior)
CREATE POLICY "Allow public read access to notifications"
ON public.notifications
FOR SELECT
USING (true);

-- Allow public insert for edge functions to create notifications
CREATE POLICY "Allow public insert on notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Allow public update for status changes
CREATE POLICY "Allow public update on notifications"
ON public.notifications
FOR UPDATE
USING (true);