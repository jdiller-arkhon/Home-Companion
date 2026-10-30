/**
 * Forward-only, versioned schema migrations. Applied in a transaction at boot.
 * Never edit a shipped migration — append a new one.
 */
export const migrations: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "initial",
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        pin_hash TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin','member')),
        color TEXT NOT NULL DEFAULT 'periwinkle',
        prefs TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE sessions (
        id_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        elevated_until INTEGER NOT NULL DEFAULT 0,
        user_agent TEXT
      );
      CREATE INDEX sessions_user ON sessions(user_id);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Typed household records. One table, many kinds, validated in code by
      -- per-kind schemas. owner_id + visibility enforce private/shared data.
      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        visibility TEXT NOT NULL CHECK (visibility IN ('shared','private')),
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        due_at INTEGER,
        amount_cents INTEGER,
        parent_id TEXT REFERENCES items(id) ON DELETE CASCADE,
        data TEXT NOT NULL DEFAULT '{}',
        position REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX items_kind ON items(kind, status, due_at);
      CREATE INDEX items_parent ON items(parent_id);

      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        actor_id TEXT,
        actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','assistant','system')),
        action TEXT NOT NULL,
        target TEXT,
        outcome TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX audit_ts ON audit_log(ts DESC);

      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
        content TEXT NOT NULL,
        meta TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX messages_conv ON messages(conversation_id, created_at);

      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = household
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE pending_actions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id TEXT,
        tool TEXT NOT NULL,
        args TEXT NOT NULL,
        summary TEXT NOT NULL,
        level TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired','failed')),
        result TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        visibility TEXT NOT NULL CHECK (visibility IN ('shared','private')),
        name TEXT NOT NULL,
        folder TEXT NOT NULL DEFAULT 'General',
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        text_enc TEXT,           -- extracted text, encrypted at rest
        text_status TEXT NOT NULL DEFAULT 'none',
        expires_at INTEGER,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = everyone
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        href TEXT,
        dedupe_key TEXT UNIQUE,
        read_by TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      );
    `,
  },
];
