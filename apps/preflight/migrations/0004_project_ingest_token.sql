ALTER TABLE project ADD COLUMN ingest_token TEXT;

CREATE INDEX IF NOT EXISTS project_ingest_token_idx ON project(id, ingest_token);
