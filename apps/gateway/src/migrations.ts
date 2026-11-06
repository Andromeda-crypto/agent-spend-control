import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { DB } from './store.js';

/** Caller owns a transaction. A checksum prevents silently editing applied migrations. */
export async function migrate(db: DB) {
  await db.query('SELECT pg_advisory_xact_lock(743061026)');
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
  const directory = new URL('../../../migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(n => /^\d+_.*\.sql$/.test(n)).sort()) {
    const sql = await readFile(new URL(name, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = (await db.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name])).rows[0];
    if (previous) {
      if (previous.checksum !== checksum) throw new Error(`migration_changed:${name}`);
      continue;
    }
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
  }
}
