import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function startGateway() {
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/gateway/src/server.ts'], {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`gateway_start_timeout:${errors}`)); }, 10000);
    let output = '';
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`gateway_exit_${code}:${errors}`)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      if (!output.includes('\n')) return;
      try {
        const ready = JSON.parse(output.split('\n')[0]);
        clearTimeout(timer); resolve(`http://127.0.0.1:${ready.listening}`);
      } catch (error) { clearTimeout(timer); child.kill(); reject(error); }
    });
  });
  return {
    url,
    async stop(crash = false) {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const ended = once(child, 'exit'); child.kill(crash ? 'SIGKILL' : 'SIGTERM'); await ended;
    },
  };
}

export async function workerProcess() {
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/worker/src/main.ts'], {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, ENABLE_FIXTURE_ADAPTER: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', errors = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`worker_exit_${code}:${errors}`);
  return JSON.parse(output);
}
