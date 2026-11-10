-- Worker collection workflow: admin assigns jobs, workers submit photo proof,
-- and only administrators can approve a request as collected.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user','admin','worker'));

ALTER TABLE collection_requests DROP CONSTRAINT IF EXISTS collection_requests_status_check;
ALTER TABLE collection_requests ADD CONSTRAINT collection_requests_status_check
  CHECK (status IN ('pending','approved','assigned','proof_submitted','in_progress','collected','stored','processed','transferred','rejected'));

ALTER TABLE collection_request_events DROP CONSTRAINT IF EXISTS collection_request_events_from_status_check;
ALTER TABLE collection_request_events ADD CONSTRAINT collection_request_events_from_status_check
  CHECK (from_status IS NULL OR from_status IN ('pending','approved','assigned','proof_submitted','in_progress','collected','stored','processed','transferred','rejected'));

ALTER TABLE collection_request_events DROP CONSTRAINT IF EXISTS collection_request_events_to_status_check;
ALTER TABLE collection_request_events ADD CONSTRAINT collection_request_events_to_status_check
  CHECK (to_status IN ('pending','approved','assigned','proof_submitted','in_progress','collected','stored','processed','transferred','rejected'));

ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS assigned_worker_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS proof_image_data TEXT;
ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS proof_image_name VARCHAR(255);
ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS proof_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_collection_requests_assigned_worker
  ON collection_requests(assigned_worker_id,status);
