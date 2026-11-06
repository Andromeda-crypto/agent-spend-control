import pg from 'pg';
import { FixtureAdapter } from '../../../packages/adapters/fixture.js';
import { runWorkerOnce } from './worker.js';

if (process.env.ENABLE_FIXTURE_ADAPTER !== 'true') throw new Error('Set ENABLE_FIXTURE_ADAPTER=true to run the synthetic demo worker');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  console.log(JSON.stringify({ fixture: true, results: await runWorkerOnce(pool, [new FixtureAdapter(pool)]) }));
} finally { await pool.end(); }
