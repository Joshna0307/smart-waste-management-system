-- Collection workflow: link each request to a waste record and keep both statuses aligned.
-- Safe to re-run. Existing requests remain valid with waste_record_id = NULL.
ALTER TABLE collection_requests
  ADD COLUMN IF NOT EXISTS waste_record_id BIGINT REFERENCES waste_records(id) ON DELETE SET NULL;

ALTER TABLE collection_requests
  DROP CONSTRAINT IF EXISTS collection_requests_status_check;
ALTER TABLE collection_requests
  ADD CONSTRAINT collection_requests_status_check
  CHECK (status IN ('pending','assigned','in_progress','collected','stored','processed','transferred','rejected','approved'));

ALTER TABLE collection_request_events
  DROP CONSTRAINT IF EXISTS collection_request_events_from_status_check;
ALTER TABLE collection_request_events
  ADD CONSTRAINT collection_request_events_from_status_check
  CHECK (from_status IS NULL OR from_status IN ('pending','assigned','in_progress','collected','stored','processed','transferred','rejected','approved'));

ALTER TABLE collection_request_events
  DROP CONSTRAINT IF EXISTS collection_request_events_to_status_check;
ALTER TABLE collection_request_events
  ADD CONSTRAINT collection_request_events_to_status_check
  CHECK (to_status IN ('pending','assigned','in_progress','collected','stored','processed','transferred','rejected','approved'));

ALTER TABLE waste_records
  DROP CONSTRAINT IF EXISTS waste_records_collection_status_check;
ALTER TABLE waste_records
  ADD CONSTRAINT waste_records_collection_status_check
  CHECK (collection_status IN ('pending','assigned','in_progress','collected','stored','processed','transferred'));

CREATE INDEX IF NOT EXISTS idx_collection_requests_waste_record
  ON collection_requests(waste_record_id);

-- Only one active request may exist for a given waste record. Completed or rejected
-- requests do not prevent a later request from being created after a record is reset.
CREATE UNIQUE INDEX IF NOT EXISTS uq_collection_requests_active_waste_record
  ON collection_requests(waste_record_id)
  WHERE waste_record_id IS NOT NULL
    AND status NOT IN ('collected','stored','processed','transferred','rejected');
