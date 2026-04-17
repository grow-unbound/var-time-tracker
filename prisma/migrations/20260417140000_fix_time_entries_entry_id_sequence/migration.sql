-- Seed inserts explicit entry_id values; advance the SERIAL sequence so new rows get unique IDs.
SELECT setval(
  pg_get_serial_sequence('public.time_entries', 'entry_id')::regclass,
  COALESCE((SELECT MAX("entry_id") FROM "time_entries"), 1)
);
