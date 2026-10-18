CREATE TABLE content_shares (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 source_key TEXT NOT NULL,
 kind TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('snapshot','live-read','live-check')),
 token_hash TEXT NOT NULL,
 write_hash TEXT,
 body TEXT NOT NULL,
 items TEXT NOT NULL DEFAULT '[]',
 version INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX content_shares_owner ON content_shares(owner_id,expires_at);
CREATE INDEX content_shares_expiry ON content_shares(expires_at);
CREATE TABLE content_share_sources (
 share_id TEXT NOT NULL REFERENCES content_shares(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL,
 source_key TEXT NOT NULL,
 PRIMARY KEY(share_id,source_key)
);
CREATE INDEX content_share_source ON content_share_sources(owner_id,source_key);
CREATE TABLE content_share_blocks (
 owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 source_key TEXT NOT NULL,
 PRIMARY KEY(owner_id,source_key)
);
