import pg from 'pg';
import { readFile } from 'node:fs/promises';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {await pool.query(await readFile('migrations/001_initial.sql','utf8'));} finally {await pool.end();}
