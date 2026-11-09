/**
 * Local mock for the Consent API (no DB, no audit).
 *
 * Purpose: run the PWA end-to-end before the real service-consent exists.
 *   pnpm mock            # 127.0.0.1:11080
 *   pnpm dev             # Vite proxies /bff to :11080
 *   open http://localhost:13113/?demo=1
 *
 * It is deliberately not production code: decisions are in-memory and reset on restart.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 11080);

let seq = 1;
const now = () => new Date().toISOString();
const iso = (ms) => new Date(Date.now() + ms).toISOString();

const items = [
  {
    id: '01JDEMOCONSENT000000000001',
    action: 'tenant.create',
    target: 'acme2',
    risk: 'R1',
    status: 'pending',
    reason: 'QA 专用租户',
    requester_type: 'agent',
    requester_id: 'agent:qa-runner',
    params_hash: 'sha256:demo-tenant-create',
    created_at: now(),
    expires_at: iso(5 * 60 * 1000),
  },
  {
    id: '01JDEMOCONSENT000000000002',
    action: 'user.reset_password',
    target: 'qa-user@acme-corp',
    risk: 'R2',
    status: 'pending',
    reason: 'QA 账号口令重置',
    requester_type: 'agent',
    requester_id: 'agent:qa-runner',
    params_hash: 'sha256:demo-reset-password',
    created_at: now(),
    expires_at: iso(5 * 60 * 1000),
  },
  {
    id: '01JDEMOCONSENT000000000003',
    action: 'service.restart',
    target: 'status-service',
    risk: 'R3',
    status: 'pending',
    reason: '状态页探针异常，重启验证',
    requester_type: 'agent',
    requester_id: 'agent:oncall',
    params_hash: 'sha256:demo-restart',
    created_at: now(),
    expires_at: iso(5 * 60 * 1000),
  },
];

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type,x-tenant-id',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) reject(new Error('body too large')); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  if (url.pathname === '/health') {
    json(res, 200, { ok: true, mock: true });
    return;
  }

  if (!url.pathname.startsWith('/bff/ops/v1/consents')) {
    json(res, 404, { error: 'not_found' });
    return;
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.slice(7).trim() === '') {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  // GET /bff/ops/v1/consents?status=pending
  if (req.method === 'GET' && url.pathname === '/bff/ops/v1/consents') {
    const status = url.searchParams.get('status');
    const list = status ? items.filter((x) => x.status === status) : items;
    json(res, 200, { items: list, total: list.length });
    return;
  }

  const m = url.pathname.match(/^\/bff\/ops\/v1\/consents\/([^/]+)(?:\/decision)?$/);
  if (!m) {
    json(res, 404, { error: 'not_found' });
    return;
  }
  const id = decodeURIComponent(m[1]);
  const item = items.find((x) => x.id === id);
  if (!item) {
    json(res, 404, { error: 'consent_not_found' });
    return;
  }

  if (req.method === 'GET' && !url.pathname.endsWith('/decision')) {
    json(res, 200, item);
    return;
  }

  if (req.method === 'POST' && url.pathname.endsWith('/decision')) {
    let body;
    try { body = await readBody(req); } catch { json(res, 400, { error: 'invalid_json' }); return; }
    const decision = body.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      json(res, 400, { error: 'invalid_decision' });
      return;
    }
    if (item.status !== 'pending') {
      json(res, 409, { error: 'not_pending', status: item.status });
      return;
    }
    item.status = decision;
    item.decided_at = now();
    item.decision = decision;
    seq += 1;
    console.log(`[mock] ${decision} ${id}`);
    json(res, 200, { ...item, receipt: { action_id: id, mock: true, seq } });
    return;
  }

  json(res, 405, { error: 'method_not_allowed' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock] Consent API on http://127.0.0.1:${PORT} (in-memory, demo only)`);
});
