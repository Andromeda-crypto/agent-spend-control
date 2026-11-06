import pg from 'pg';
import { createGateway } from './app.js';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const server = createGateway(pool);
server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => {
  const address = server.address();
  console.log(JSON.stringify({ listening: typeof address === 'object' && address ? address.port : address }));
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => { server.close(() => { void pool.end(); }); });
}
