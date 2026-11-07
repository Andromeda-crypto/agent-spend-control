import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import pg from 'pg';

const run = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'spend-postgres-'));
const binary = (name: string) => process.env.PG_BIN ? join(process.env.PG_BIN, name) : name;
const port = 20000 + Math.floor(Math.random() * 30000);
let started = false;
try {
  await run(binary('initdb'), ['-D', join(directory, 'data'), '-A', 'trust', '-U', 'spend', '--no-locale']);
  await run(binary('pg_ctl'), ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'),
    '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start']);
  started = true;
  const url = `postgres://spend@127.0.0.1:${port}/postgres`;
  const pool = new pg.Pool({ connectionString: url });
  console.log((await pool.query('SELECT version()')).rows[0].version);
  await pool.end();
  const args=process.argv.includes('--with-solana')?['--import','tsx','scripts/test-solana.ts','--fullstack']:['--import','tsx','--test','test/postgres/*.test.ts'];
  const child = spawn(process.execPath, args, {
    stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: url },
  });
  const [code] = await once(child, 'exit');
  process.exitCode = typeof code === 'number' ? code : 1;
} catch (error) {
  console.error(error);
  try { console.error(await readFile(join(directory, 'postgres.log'), 'utf8')); } catch {}
  process.exitCode = 1;
} finally {
  if (started) await run(binary('pg_ctl'), ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop']);
  await rm(directory, { recursive: true, force: true });
}
