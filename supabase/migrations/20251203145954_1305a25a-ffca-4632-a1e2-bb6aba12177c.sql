-- Enable realtime for claims table
ALTER PUBLICATION supabase_realtime ADD TABLE public.claims;

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;