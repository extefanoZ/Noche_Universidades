import { DatabaseSync } from 'node:sqlite';

export function createSQLiteStore(path) {
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE IF NOT EXISTS resultados (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'general' CHECK (audience IN ('general', 'ingenieria')),
      instagram TEXT,
      score INTEGER NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const columns = database.prepare('PRAGMA table_info(resultados)').all().map(({ name }) => name);
  if (!columns.includes('audience')) {
    database.exec("ALTER TABLE resultados ADD COLUMN audience TEXT NOT NULL DEFAULT 'general' CHECK (audience IN ('general', 'ingenieria'))");
  }
  if (!columns.includes('instagram')) {
    database.exec('ALTER TABLE resultados ADD COLUMN instagram TEXT');
  }
  const save = database.prepare(`
    INSERT INTO resultados (id, name, phone, audience, instagram, score)
    VALUES (?, ?, '', ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const results = database.prepare(`
    SELECT name, score FROM resultados
    WHERE audience = ?
    ORDER BY score DESC, submitted_at ASC, rowid ASC
    LIMIT 50
  `);
  const contacts = database.prepare(`
    SELECT name, instagram, audience, score FROM resultados
    WHERE instagram IS NOT NULL AND instagram <> ''
    ORDER BY score DESC, submitted_at ASC, rowid ASC
  `);

  let session;
  let attempts = 0;
  let retryAt = 0;

  return {
    saveResult({ id, name, audience, instagram, score }) {
      save.run(id, name, audience, instagram, score);
    },
    listResults: (audience) => results.all(audience),
    listContacts: () => contacts.all(),
    takeAdminAttempt() {
      const now = Date.now();
      if (now >= retryAt) {
        attempts = 0;
        retryAt = now + 60_000;
      }
      if (attempts >= 8) return false;
      attempts++;
      return true;
    },
    saveAdminSession(hash, expires) {
      session = { hash, expires };
      attempts = 0;
    },
    hasAdminSession: (hash) => session?.hash === hash && Date.now() < session.expires,
    deleteAdminSession(hash) {
      if (session?.hash === hash) session = undefined;
    },
  };
}
