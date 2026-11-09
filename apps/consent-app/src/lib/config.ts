const DEV_FALLBACK: AppConfig = {
  VITE_REGION: 'cn',
  VITE_SITE_URL: 'http://localhost:13113',
  VITE_API_BASE_URL: '/bff',
  VITE_OAUTH_BASE_URL: '',
  VITE_AUTH_BASE_URL: 'https://auth.autional.cn',
  VITE_OAUTH_CLIENT_ID: '',
  VITE_CONSENT_BASE_URL: '/bff/ops/v1',
  VITE_CONSENT_DEV_HEADERS: '0',
  VITE_CDN_HOST: 'https://cdn.autional.cn',
  VITE_COOKIE_DOMAIN: '.autional.cn',
  VITE_PORTAL_CONFIG: {},
};

export function getConfig(): AppConfig {
  if (typeof window !== 'undefined' && window.__APP_CONFIG__) {
    return { ...DEV_FALLBACK, ...window.__APP_CONFIG__ };
  }
  return DEV_FALLBACK;
}

/** 本地 dev 用 location.origin；生产用站点域名，避免 localhost 回调被拒。 */
export function redirectUri(): string {
  const cfg = getConfig();
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const base = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    ? window.location.origin
    : cfg.VITE_SITE_URL;
  return `${base.replace(/\/+$/, '')}/oauth/callback`;
}
