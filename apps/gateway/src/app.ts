import { createServer } from 'node:http';
import type pg from 'pg';
import { z } from 'zod';
import { transaction } from './database.js';
import { TaskCreated, RequestView, Snapshot, ActionResult, PolicyEdited } from '../../../packages/sdk/src/contracts.js';
import { bindVault } from './vault.js';
import type { VaultConfiguration } from '../../../packages/solana/binding.js';
import { Policy } from '../../../packages/policy/src/index.js';

const failures: Record<string, number> = {
  research_mode_mismatch:409, research_already_running:409, vault_not_configured:409, vault_asset_mismatch:409, vault_task_mismatch:409,
  invalid_binding_signature:403, vault_identity_mismatch:409, vault_policy_mismatch:409, invalid_token_account:409, vault_funding_or_token_mismatch:409,
  task_already_used:409, binding_conflict:409, cluster_identity_mismatch:409,
  onchain_policy_immutable: 409, live_execution_disabled: 409, asset_immutable: 409, unauthorized: 403, not_found: 404, body_too_large: 413,
  idempotency_conflict: 409, task_inactive: 409, not_allowed: 409, hard_limit: 409,
  invalid_state: 409, policy_version_conflict: 409, policy_below_committed_usage: 409,
};
const Edit = z.object({ expectedVersion: z.number().int().positive(), policy: Policy }).strict();
export function createGateway(pool: pg.Pool, options:{vault?:VaultConfiguration;localModel?:boolean;devnetDemoModel?:boolean}={}) {
  return createServer(async (req, res) => {
    if (req.url?.startsWith('/api/')) req.url = req.url.slice(4);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method === 'GET' && req.url === '/health') { res.end(JSON.stringify({ status: 'ok' })); return; }
      const registration = req.method === 'POST' && req.url === '/owners';
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/)?.[1];
      if (!token && !registration) throw new Error('unauthorized');
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 65536) throw new Error('body_too_large');
        chunks.push(Buffer.from(chunk));
      }
      const data = Buffer.concat(chunks).toString('utf8');
      const body = z.record(z.string(),z.unknown()).parse(data ? JSON.parse(data) : {});
      const parts = new URL(req.url ?? '/', 'http://localhost').pathname.split('/').filter(Boolean);
      const auth = token ?? '';
      if(req.method==='POST'&&parts[0]==='tasks'&&parts[2]==='vault'&&parts.length===3){
        if(!options.vault)throw new Error('vault_not_configured');
        res.end(JSON.stringify(await bindVault(pool,options.vault,parts[1],auth,body)));return;
      }
      const result = await transaction(pool, async store => {
        if (req.method === 'GET' && req.url === '/capabilities') {
          await store.identity(auth);
          return { fixtureEnabled:process.env.ENABLE_FIXTURE_ADAPTER==='true',openaiConfigured:!!process.env.OPENAI_API_KEY,liveEnabled:process.env.ENABLE_LIVE_EXECUTION==='true',localModelEnabled:!!options.localModel,simulatedModelEnabled:!!(options.localModel||options.devnetDemoModel),vaultConfiguration:options.vault?{program:options.vault.client.program,cluster:options.vault.cluster,agent:options.vault.agent,mint:options.vault.mint,recipientWallet:options.vault.recipientWallet}:null };
        }
        if (registration) return store.registerOwner(body);
        if (req.method === 'GET' && req.url === '/identity') return store.identity(auth);
        if (req.method === 'POST' && req.url === '/identity/rotate') return store.rotateOwner(auth);
        if (req.method === 'POST' && parts[0] === 'tasks' && parts[2] === 'agent' && parts.length === 4 && ['rotate','revoke'].includes(parts[3]))
          return store.rotateAgent(parts[1], auth, parts[3] === 'revoke');
        if (req.method === 'POST' && parts.length === 1 && parts[0] === 'tasks')
          return TaskCreated.parse(await store.create(auth, body));
        if (parts[0] !== 'tasks') throw new Error('not_found');
        if (req.method === 'GET' && parts.length === 2)
          return Snapshot.parse(await store.snapshot(parts[1], auth));
        if (req.method === 'PATCH' && parts.length === 3 && parts[2] === 'policy') {
          const edit = Edit.parse(body);
          return PolicyEdited.parse(await store.editPolicy(parts[1], auth, edit.expectedVersion, edit.policy));
        }
        if (req.method === 'POST' && parts[2] === 'research' && parts.length === 3) {
          if(body.mode==='devnet-demo'&&(!options.devnetDemoModel||options.vault?.cluster!=='devnet'))throw new Error('live_execution_disabled');
          if (body.mode === 'local' && (!options.localModel||options.vault?.cluster!=='localnet'))throw new Error('live_execution_disabled');
          if (body.mode === 'live' && process.env.ENABLE_LIVE_EXECUTION !== 'true') throw new Error('live_execution_disabled');
          return store.startResearch(parts[1], auth, body);
        }
        if (req.method !== 'POST') throw new Error('not_found');
        if (parts[2] === 'requests' && parts.length === 3) {
          const localAllowed=body.provider==='solana'&&(options.vault?.cluster==='localnet'||options.vault?.cluster==='devnet'&&options.devnetDemoModel)||body.provider==='local-model'&&(options.localModel||options.devnetDemoModel);
          if (!localAllowed && body.provider !== 'fixture' && process.env.ENABLE_LIVE_EXECUTION !== 'true') throw new Error('live_execution_disabled');
          const key = z.string().min(1).max(200).parse(req.headers['idempotency-key']);
          return RequestView.parse(await store.reserve(parts[1], auth, key, body));
        }
        if (parts[2] === 'requests' && parts[4] === 'approve' && parts.length === 5) {
          z.object({}).strict().parse(body);
          return RequestView.parse(await store.approve(parts[1], parts[3], auth));
        }
        if (parts.length === 3 && ['pause','revoke','resume'].includes(parts[2])) {
          z.object({}).strict().parse(body);
          return ActionResult.parse(await store.control(parts[1], auth, parts[2] as 'pause' | 'revoke' | 'resume'));
        }
        throw new Error('not_found');
      });
      res.end(JSON.stringify(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const invalid = error instanceof z.ZodError || error instanceof SyntaxError;
      res.statusCode = invalid ? 400 : failures[message] ?? 500;
      res.end(JSON.stringify({ error: invalid ? 'invalid_request' : failures[message] ? message : 'internal_error' }));
    }
  });
}
