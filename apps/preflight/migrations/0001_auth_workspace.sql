CREATE TABLE IF NOT EXISTS user (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	email_verified INTEGER NOT NULL DEFAULT 0,
	image TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
	id TEXT PRIMARY KEY NOT NULL,
	expires_at INTEGER NOT NULL,
	token TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	ip_address TEXT,
	user_agent TEXT,
	user_id TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_userId_idx ON session(user_id);

CREATE TABLE IF NOT EXISTS account (
	id TEXT PRIMARY KEY NOT NULL,
	account_id TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	access_token TEXT,
	refresh_token TEXT,
	id_token TEXT,
	access_token_expires_at INTEGER,
	refresh_token_expires_at INTEGER,
	scope TEXT,
	password TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS account_userId_idx ON account(user_id);

CREATE TABLE IF NOT EXISTS verification (
	id TEXT PRIMARY KEY NOT NULL,
	identifier TEXT NOT NULL,
	value TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

CREATE TABLE IF NOT EXISTS workspace (
	id TEXT PRIMARY KEY NOT NULL,
	owner_user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (owner_user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS workspace_owner_user_id_idx ON workspace(owner_user_id);

CREATE TABLE IF NOT EXISTS workspace_member (
	workspace_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (workspace_id, user_id),
	FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project (
	id TEXT PRIMARY KEY NOT NULL,
	workspace_id TEXT NOT NULL,
	name TEXT NOT NULL,
	deploy_url TEXT NOT NULL,
	repo_label TEXT NOT NULL,
	workflow_path TEXT NOT NULL DEFAULT '.github/workflows/deploylint.yml',
	install_state TEXT NOT NULL DEFAULT 'not_installed',
	gate_mode TEXT NOT NULL DEFAULT 'advisory',
	min_score INTEGER NOT NULL DEFAULT 80,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS project_workspace_id_idx ON project(workspace_id);

CREATE TABLE IF NOT EXISTS subscription (
	id TEXT PRIMARY KEY NOT NULL,
	workspace_id TEXT NOT NULL,
	stripe_customer_id TEXT,
	stripe_subscription_id TEXT,
	plan TEXT NOT NULL DEFAULT 'solo',
	status TEXT NOT NULL DEFAULT 'setup',
	current_period_end INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS subscription_workspace_id_idx ON subscription(workspace_id);
