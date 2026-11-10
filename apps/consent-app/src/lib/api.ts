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

export async function registerDevice(name: string): Promise<ConsentDevice> {
  const body = await request<unknown>('/devices', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return unwrap<ConsentDevice>(body);
}

export async function decide(id: string, decision: 'approved' | 'rejected', deviceId?: string, reason?: string): Promise<ConsentRequest> {
  const body = await request<unknown>(`/consents/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, ...(deviceId ? { device_id: deviceId } : {}), ...(reason ? { reason } : {}) }),
  });
  return unwrap<ConsentRequest>(body);
}

export async function cancelConsent(id: string, reason?: string): Promise<ConsentRequest> {
  const body = await request<unknown>(`/consents/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? '' }),
  });
  return unwrap<ConsentRequest>(body);
}
