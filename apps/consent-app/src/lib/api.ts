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
  const res = await fetch(`${cfg.VITE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

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

export async function listPending(): Promise<ConsentRequest[]> {
  const body = await request<unknown>('/ops/v1/consents?status=pending');
  const data = unwrap<ConsentRequest[] | { items?: ConsentRequest[] }>(body);
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export async function getConsent(id: string): Promise<ConsentRequest> {
  const body = await request<unknown>(`/ops/v1/consents/${encodeURIComponent(id)}`);
  return unwrap<ConsentRequest>(body);
}

export async function decide(id: string, decision: 'approved' | 'rejected'): Promise<ConsentRequest> {
  const body = await request<unknown>(`/ops/v1/consents/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
  return unwrap<ConsentRequest>(body);
}
