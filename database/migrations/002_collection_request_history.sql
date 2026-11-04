-- Safe, rerunnable audit history for campus collection requests.
CREATE TABLE IF NOT EXISTS collection_request_events (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES collection_requests(id) ON DELETE CASCADE,
  changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  from_status VARCHAR(20) CHECK (from_status IS NULL OR from_status IN ('pending','approved','in_progress','collected','rejected')),
  to_status VARCHAR(20) NOT NULL CHECK (to_status IN ('pending','approved','in_progress','collected','rejected')),
  note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collection_requests_owner_created
  ON collection_requests(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_request_events_request_created
  ON collection_request_events(request_id, created_at, id);

-- Preserve a visible initial event for requests created before history was added.
INSERT INTO collection_request_events(request_id, changed_by, from_status, to_status, note, created_at)
SELECT c.id, c.requested_by, NULL, c.status, 'Initial status (history backfill)', c.created_at
FROM collection_requests c
WHERE NOT EXISTS (
  SELECT 1 FROM collection_request_events e WHERE e.request_id = c.id
);
