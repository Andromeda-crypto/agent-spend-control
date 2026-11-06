import type pg from 'pg';
import { Store } from './store.js';

/** All lifecycle locks and writes use the same checked-out connection. */
export async function transaction<T>(pool: pg.Pool, work: (store: Store) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query("SET LOCAL lock_timeout = '5s'");
    const result = await work(new Store(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
