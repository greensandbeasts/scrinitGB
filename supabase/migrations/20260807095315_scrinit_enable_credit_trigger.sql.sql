-- The enforce_upload_credit trigger was disabled (tgenabled = 'D').
-- Re-enable it so the AFTER INSERT credit consumption logic actually fires.

ALTER TABLE public.screenplays ENABLE TRIGGER enforce_upload_credit;
