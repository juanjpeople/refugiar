CREATE TABLE project_shares (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL,
 recipient TEXT NOT NULL,
 token_hash TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX project_shares_owner ON project_shares(owner_id, project_id);
CREATE INDEX project_shares_expiry ON project_shares(expires_at);
