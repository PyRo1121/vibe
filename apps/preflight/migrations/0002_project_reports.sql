CREATE TABLE IF NOT EXISTS project_report (
	id TEXT PRIMARY KEY NOT NULL,
	project_id TEXT NOT NULL,
	report_id TEXT,
	score INTEGER NOT NULL,
	verdict TEXT NOT NULL,
	scanned_at TEXT NOT NULL,
	fixed_count INTEGER NOT NULL DEFAULT 0,
	regressed_count INTEGER NOT NULL DEFAULT 0,
	final_url TEXT NOT NULL,
	commit_sha TEXT,
	branch TEXT,
	pull_request TEXT,
	created_at INTEGER NOT NULL,
	FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS project_report_project_scanned_at_idx ON project_report(project_id, scanned_at DESC);

