import { createServer } from 'node:http';
import type pg from 'pg';
import { z } from 'zod';
import { transaction } from './database.js';
import { TaskCreated, RequestView, Snapshot, ActionResult, PolicyEdited } from '../../../packages/sdk/src/contracts.js';
import { Policy } from '../../../packages/policy/src/index.js';

const failures: Record<string, number> = {
  unauthorized: 403, not_found: 404, body_too_large: 413,
  idempotency_conflict: 409, task_inactive: 409, not_allowed: 409, hard_limit: 409,
  invalid_state: 409, policy_version_conflict: 409, policy_below_committed_usage: 409,
};
const Edit = z.object({ expectedVersion: z.number().int().positive(), policy: Policy }).strict();
export function createGateway(pool: pg.Pool) {
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method === 'GET' && req.url === '/health') { res.end(JSON.stringify({ status: 'ok' })); return; }
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/)?.[1];
      if (!token) throw new Error('unauthorized');
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 65536) throw new Error('body_too_large');
        chunks.push(Buffer.from(chunk));
      }
      const data = Buffer.concat(chunks).toString('utf8');
      const body = data ? JSON.parse(data) : {};
      const parts = new URL(req.url ?? '/', 'http://localhost').pathname.split('/').filter(Boolean);
      const result = await transaction(pool, async store => {
        if (req.method === 'POST' && parts.length === 1 && parts[0] === 'tasks')
          return TaskCreated.parse(await store.create(token, body));
        if (parts[0] !== 'tasks') throw new Error('not_found');
        if (req.method === 'GET' && parts.length === 2)
          return Snapshot.parse(await store.snapshot(parts[1], token));
        if (req.method === 'PATCH' && parts.length === 3 && parts[2] === 'policy') {
          const edit = Edit.parse(body);
          return PolicyEdited.parse(await store.editPolicy(parts[1], token, edit.expectedVersion, edit.policy));
        }
        if (req.method !== 'POST') throw new Error('not_found');
        if (parts[2] === 'requests' && parts.length === 3) {
          const key = z.string().min(1).max(200).parse(req.headers['idempotency-key']);
          return RequestView.parse(await store.reserve(parts[1], token, key, body));
        }
        if (parts[2] === 'requests' && parts[4] === 'approve' && parts.length === 5) {
          z.object({}).strict().parse(body);
          return RequestView.parse(await store.approve(parts[1], parts[3], token));
        }
        if (parts.length === 3 && ['pause','revoke','resume'].includes(parts[2])) {
          z.object({}).strict().parse(body);
          return ActionResult.parse(await store.control(parts[1], token, parts[2] as 'pause' | 'revoke' | 'resume'));
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
