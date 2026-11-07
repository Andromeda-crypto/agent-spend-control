import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, open } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const temp = await mkdtemp(join(tmpdir(), 'spend-validator-'));
const log = await open(join(temp, 'validator.log'), 'w');
const port = 12000 + Math.floor(Math.random() * 1000) * 10;
const program = (await readFile('programs/spending-vault/src/lib.rs', 'utf8')).match(/declare_id!\("([^"]+)"\)/)![1];
const executable = join(process.env.SOLANA_BIN ?? join(homedir(),'.local/share/solana/install/active_release/bin'), 'solana-test-validator');
const child = spawn(executable, ['--ledger', join(temp, 'ledger'), '--reset', '--rpc-port', String(port),
  '--faucet-port', String(port+2), '--gossip-port', String(port+3), '--bind-address', '127.0.0.1',
  '--bpf-program', program, 'target/deploy/spending_vault.so', '--quiet'], { stdio: ['ignore', log.fd, log.fd] });
let spawnError: Error | undefined; child.on('error', error => { spawnError = error; });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error('validator_exited');
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getHealth' }) });
      if ((await response.json()).result === 'ok') { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('validator_start_timeout');
  const tests = spawn(process.execPath, ['--import', 'tsx', '--test', 'test/solana/*.test.ts'], {
    stdio: 'inherit', env: { ...process.env, SOLANA_RPC_URL: `http://127.0.0.1:${port}`, SOLANA_PROGRAM_ID: program },
  });
  const [code] = await once(tests, 'exit'); process.exitCode = typeof code === 'number' ? code : 1;
  if (code !== 0) console.error((await readFile(join(temp, 'ledger/validator.log'), 'utf8').catch(()=>readFile(join(temp,'validator.log'),'utf8'))).slice(-7000));
} catch (error) {
  console.error(error); console.error((await readFile(join(temp, 'validator.log'), 'utf8')).slice(-6000)); process.exitCode = 1;
} finally {
  if (child.exitCode === null && child.pid) {
    const ended = once(child, 'exit'); child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    await ended; clearTimeout(timer);
  }
  await log.close(); await rm(temp, { recursive: true, force: true });
}
