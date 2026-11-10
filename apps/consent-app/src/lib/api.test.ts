import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelConsent, decide, listConsents, listPending } from './api';

vi.mock('./auth', () => ({ getToken: () => 'test-token' }));
vi.mock('./config', () => ({
  getConfig: () => ({ VITE_CONSENT_BASE_URL: '/bff/consent/api/v1/ops' }),
}));

function mockFetch(body: unknown = { items: [] }) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('consent API paths', () => {
  it('uses base + /consents for pending', async () => {
    const f = mockFetch();
    await listPending();
    expect(f).toHaveBeenCalledWith('/bff/consent/api/v1/ops/consents?status=pending', expect.any(Object));
  });

  it('uses base + /consents for history status', async () => {
    const f = mockFetch();
    await listConsents('approved');
    expect(f).toHaveBeenCalledWith('/bff/consent/api/v1/ops/consents?status=approved', expect.any(Object));
  });

  it('sends device_id and reason on decision', async () => {
    const f = mockFetch({ id: 'c1', status: 'approved' });
    await decide('c1', 'approved', 'd1', 'ok');
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ decision: 'approved', device_id: 'd1', reason: 'ok' });
  });

  it('sends reason on cancel', async () => {
    const f = mockFetch({ id: 'c1', status: 'canceled' });
    await cancelConsent('c1', 'withdraw');
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'withdraw' });
  });
});
