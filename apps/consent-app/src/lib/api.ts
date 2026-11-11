import { getConfig } from './config';
import { getToken } from './auth';
import type { ConsentRequest } from './format';

export class AuthRequiredError extends Error {
  constructor() {
    super('AUTH_REQUIRED');
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new AuthRequiredError();

  const cfg = getConfig();
  const base = cfg.VITE_CONSENT_BASE_URL || '/bff/ops/v1';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  // 本地 dev：service-consent 直接信任网关注入头；生产由网关注入，前端不伪造。
  if (import.meta.env.DEV && cfg.VITE_CONSENT_DEV_HEADERS === '1') {
    headers['X-User-ID'] = 'dev-user';
    headers['X-Tenant-ID'] = 'tenant-a';
    headers['X-User-Roles'] = 'super_admin';
  }
  const res = await fetch(`${base}${path}`, { ...init, headers });

  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function listConsents(status?: string): Promise<ConsentRequest[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const body = await request<unknown>(`/consents${q}`);
  const data = unwrap<ConsentRequest[] | { items?: ConsentRequest[] }>(body);
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

/**
 * Platform operator view: every tenant's pending work. The server rejects this
 * with 403 unless the caller belongs to the platform tenant, so the toggle that
 * calls it can stay visible and simply report "not allowed".
 */
export interface ConsentPage {
  items: ConsentRequest[];
  hasMore: boolean;
  offset: number;
}

/**
 * Bounded list page. Without this the UI would silently show only the first
 * server-side page and hide the rest.
 */
export async function listConsentsPage(opts: {
  status?: string;
  offset?: number;
  limit?: number;
  all?: boolean;
} = {}): Promise<ConsentPage> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  params.set('limit', String(opts.limit ?? 100));
  if (opts.offset) params.set('offset', String(opts.offset));
  const path = opts.all ? '/consents/all' : '/consents';
  const body = await request<unknown>(`${path}?${params.toString()}`);
  const data = unwrap<{ items?: ConsentRequest[]; has_more?: boolean } | ConsentRequest[]>(body);
  if (Array.isArray(data)) return { items: data, hasMore: false, offset: opts.offset ?? 0 };
  return { items: data.items ?? [], hasMore: Boolean(data.has_more), offset: opts.offset ?? 0 };
}

export async function listAllConsents(status?: string): Promise<ConsentRequest[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const body = await request<unknown>(`/consents/all${q}`);
  const data = unwrap<ConsentRequest[] | { items?: ConsentRequest[] }>(body);
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export async function listPending(): Promise<ConsentRequest[]> {
  return listConsents('pending');
}

export async function getConsent(id: string): Promise<ConsentRequest> {
  const body = await request<unknown>(`/consents/${encodeURIComponent(id)}`);
  return unwrap<ConsentRequest>(body);
}

export interface ConsentDevice {
  id: string;
  name: string;
  revoked_at?: string | null;
}

export async function listDevices(): Promise<ConsentDevice[]> {
  const body = await request<unknown>('/devices');
  const data = unwrap<{ items?: ConsentDevice[] } | ConsentDevice[]>(body);
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export interface DeviceRegistration {
  name: string;
  public_key?: string;
  key_alg?: string;
}

export async function registerDevice(nameOrOpts: string | DeviceRegistration): Promise<ConsentDevice> {
  const payload: DeviceRegistration =
    typeof nameOrOpts === 'string' ? { name: nameOrOpts } : nameOrOpts;
  const body = await request<unknown>('/devices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return unwrap<ConsentDevice>(body);
}

export interface FactorProof {
  factor: string;
  code: string;
}

export interface DeviceAttestation {
  device_signed_at: string;
  device_signature: string;
}

export async function decide(
  id: string,
  decision: 'approved' | 'rejected',
  deviceId?: string,
  reason?: string,
  proof?: FactorProof,
  attestation?: DeviceAttestation,
): Promise<ConsentRequest> {
  const body = await request<unknown>(`/consents/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify({
      decision,
      ...(deviceId ? { device_id: deviceId } : {}),
      ...(reason ? { reason } : {}),
      ...(proof ? { factor: proof.factor, factor_proof: proof.code } : {}),
      ...(attestation ?? {}),
    }),
  });
  return unwrap<ConsentRequest>(body);
}

export interface FactorChallenge {
  challenge_id: string;
  factor: string;
  expires_at: string;
  destination?: string;
  max_attempts?: number;
}

/** Ask the server to send one approval code bound to this request. */
export async function issueFactorChallenge(id: string, factor: string): Promise<FactorChallenge> {
  const body = await request<unknown>(`/consents/${encodeURIComponent(id)}/factor-challenge`, {
    method: 'POST',
    body: JSON.stringify({ factor }),
  });
  return unwrap<FactorChallenge>(body);
}

/**
 * One-time ticket for the SSE channel. Browsers cannot set an Authorization
 * header on EventSource, so the token stays here and only the short-lived
 * ticket travels in the URL.
 */
export async function createStreamTicket(): Promise<string> {
  const body = await request<unknown>('/consents/stream-ticket', { method: 'POST' });
  const data = unwrap<{ ticket?: string }>(body);
  if (!data?.ticket) throw new Error('stream ticket missing');
  return data.ticket;
}

export async function cancelConsent(id: string, reason?: string): Promise<ConsentRequest> {
  const body = await request<unknown>(`/consents/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? '' }),
  });
  return unwrap<ConsentRequest>(body);
}
