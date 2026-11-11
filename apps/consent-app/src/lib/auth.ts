import { getConfig, redirectUri } from './config';
import { parseErrorMessage } from './errors';

const TOKEN_KEY = 'consent.access_token';
const VERIFIER_KEY = 'consent.pkce.verifier';
const STATE_KEY = 'consent.pkce.state';
const RETURN_KEY = 'consent.return_to';
const DEMO_KEY = 'consent.demo';

export function demoAvailable(): boolean {
  return import.meta.env.DEV;
}

function demoEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(DEMO_KEY) === '1') return true;
  return new URLSearchParams(window.location.search).has('demo');
}

export function enableDemo(): void {
  sessionStorage.setItem(DEMO_KEY, '1');
  window.location.assign('/');
}

export function disableDemo(): void {
  sessionStorage.removeItem(DEMO_KEY);
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export function getToken(): string {
  if (demoEnabled()) {
    sessionStorage.setItem(DEMO_KEY, '1');
    return 'demo-token';
  }
  return sessionStorage.getItem(TOKEN_KEY) ?? '';
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isDemo(): boolean {
  return demoEnabled();
}

export function logout(): void {
  clearToken();
  disableDemo();
  try {
    localStorage.removeItem('consent.device_id');
  } catch {
    // ignore storage-disabled environments
  }
  window.location.assign('/');
}

export async function beginLogin(returnTo = '/'): Promise<void> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) {
    enableDemo();
    return;
  }
  const cfg = getConfig();
  if (!cfg.VITE_OAUTH_CLIENT_ID) {
    throw new Error('缺少 VITE_OAUTH_CLIENT_ID：请给 consent 注册独立 OAuth client');
  }

  const verifier = randomString(48);
  const state = randomString(24);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, returnTo);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.VITE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: 'openid profile',
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
  });

  window.location.assign(`${cfg.VITE_AUTH_BASE_URL}/oauth/api/v1/oauth/authorize?${params.toString()}`);
}

export async function completeLogin(search: string): Promise<string> {
  const cfg = getConfig();
  const q = new URLSearchParams(search);
  const code = q.get('code');
  const state = q.get('state');
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  if (!code) throw new Error(q.get('error_description') || q.get('error') || '缺少授权码');
  if (!state || state !== expectedState) throw new Error('OAuth state 不匹配');
  if (!verifier) throw new Error('缺少 PKCE verifier（登录会话已过期）');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.VITE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });

  const res = await fetch(`${cfg.VITE_OAUTH_BASE_URL}/oauth/api/v1/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`换取令牌失败：${parseErrorMessage(text, res.status)}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('令牌响应缺少 access_token');

  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  const returnTo = sessionStorage.getItem(RETURN_KEY) || '/';
  sessionStorage.removeItem(RETURN_KEY);
  return returnTo;
}
