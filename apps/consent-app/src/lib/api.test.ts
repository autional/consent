import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelConsent, decide, issueFactorChallenge, listAllConsents, listConsents, listConsentsPage, listPending } from './api';

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

function mockFetchStatus(body: unknown, status: number) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('consent API error envelope', () => {
  it('surfaces detail from the platform envelope', async () => {
    mockFetchStatus({ code: 'invalid_policy', error: 'invalid_policy', detail: '策略要求二次确认' }, 400);
    await expect(listPending()).rejects.toThrow('策略要求二次确认');
  });

  it('falls back to error when detail/title are absent', async () => {
    mockFetchStatus({ error: 'invalid internal key' }, 400);
    await expect(listPending()).rejects.toThrow('invalid internal key');
  });

  it('keeps plain-text errors readable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
    await expect(listPending()).rejects.toThrow('502');
  });
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

  it('uses the platform endpoint for the cross-tenant view', async () => {
    const f = mockFetch();
    await listAllConsents('pending');
    expect(f).toHaveBeenCalledWith('/bff/consent/api/v1/ops/consents/all?status=pending', expect.any(Object));
  });

  it('asks for a bounded page and reports has_more', async () => {
    const f = mockFetch({ items: [{ id: 'c1' }], has_more: true });
    const page = await listConsentsPage({ status: 'pending', limit: 50, offset: 100 });
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(1);
    expect(f).toHaveBeenCalledWith(
      '/bff/consent/api/v1/ops/consents?status=pending&limit=50&offset=100',
      expect.any(Object),
    );
  });

  it('sends device_id and reason on decision', async () => {
    const f = mockFetch({ id: 'c1', status: 'approved' });
    await decide('c1', 'approved', 'd1', 'ok');
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ decision: 'approved', device_id: 'd1', reason: 'ok' });
  });

  it('sends factor proof on decision', async () => {
    const f = mockFetch({ id: 'c1', status: 'approved' });
    await decide('c1', 'approved', 'd1', 'ok', { factor: 'sms_otp', code: '123456' });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      decision: 'approved', device_id: 'd1', reason: 'ok', factor: 'sms_otp', factor_proof: '123456',
    });
  });

  it('requests an approval challenge for this consent', async () => {
    const f = mockFetch({ challenge_id: 'ch1', factor: 'sms_otp', expires_at: '2026-11-11T00:00:00Z' });
    const ch = await issueFactorChallenge('c1', 'sms_otp');
    expect(ch.challenge_id).toBe('ch1');
    expect(f).toHaveBeenCalledWith('/bff/consent/api/v1/ops/consents/c1/factor-challenge', expect.any(Object));
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ factor: 'sms_otp' });
  });

  it('sends reason on cancel', async () => {
    const f = mockFetch({ id: 'c1', status: 'canceled' });
    await cancelConsent('c1', 'withdraw');
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'withdraw' });
  });
});
