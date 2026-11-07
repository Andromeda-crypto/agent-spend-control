import pg from 'pg';
import { vaultConfiguration } from './configuration.js';
import { createGateway } from './app.js';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const server = createGateway(pool,{vault:vaultConfiguration(),localModel:process.env.ENABLE_LOCALNET_MODEL==='true',devnetDemoModel:process.env.ENABLE_DEVNET_DEMO_MODEL==='true'});
server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => {
  const address = server.address();
  console.log(JSON.stringify({ listening: typeof address === 'object' && address ? address.port : address }));
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => { server.close(() => { void pool.end(); }); });
}
