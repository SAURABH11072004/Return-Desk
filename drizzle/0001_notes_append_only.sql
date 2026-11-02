-- Notes are a permanent record: once written they are never edited or deleted.
-- The API exposes no way to do either; this trigger makes the database refuse it too.
CREATE FUNCTION return_notes_reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'return_notes is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER return_notes_append_only
BEFORE UPDATE OR DELETE ON return_notes
FOR EACH ROW EXECUTE FUNCTION return_notes_reject_change();
