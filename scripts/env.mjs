/**
 * 构建期环境读取单点（vite.config.ts 与 gen-env.mjs 共用）。
 *
 * 生产（VERCEL_ENV=production 或 AUTIONAL_STRICT_ENV=1）缺关键变量即抛错：
 *   REGION / SITE_URL / API_ORIGIN / VITE_OAUTH_CLIENT_ID
 * 本地 dev 无 env 时兜底 cn 值，方便起服务。
 */
const STRICT_REQUIRED = ['REGION', 'SITE_URL', 'API_ORIGIN', 'VITE_OAUTH_CLIENT_ID'];

function assertStrictEnv(env) {
  if (env.AUTIONAL_STRICT_ENV !== '1' && env.VERCEL_ENV !== 'production') return;
  const missing = STRICT_REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      '[build-env] 生产构建缺少环境变量：' + missing.join(' / ') +
        ' —— 请在 Vercel 项目设置里补齐。',
    );
  }
  if (!['cn', 'com'].includes(env.REGION)) {
    throw new Error('[build-env] REGION 只允许 cn|com，收到：' + env.REGION);
  }
  const host = new URL(env.SITE_URL).host;
  if (!host.endsWith('.' + env.REGION)) {
    throw new Error(
      '[build-env] REGION=' + env.REGION + ' 与 SITE_URL=' + env.SITE_URL +
        ' 的顶级域不一致（两区环境变量串台？）',
    );
  }
}

const pickLang = (v) => (v === 'en' || v === 'zh' ? v : undefined);

export function readBuildEnv(env = process.env) {
  assertStrictEnv(env);

  const region = env.REGION === 'com' ? 'com' : 'cn';
  const siteUrl = (env.SITE_URL || 'https://consent.autional.cn').replace(/\/+$/, '');
  const defaultLang = pickLang(env.DEFAULT_LANG) ?? (region === 'com' ? 'en' : 'zh');
  const fallbackLang = pickLang(env.FALLBACK_LANG) ?? defaultLang;
  const cdnHost = (env.CDN_HOST || `https://cdn.autional.${region}`).replace(/\/+$/, '');
  const siteHost = new URL(siteUrl).host;
  const rootDomain = siteHost.split('.').slice(-2).join('.');
  const oauthClientId = env.VITE_OAUTH_CLIENT_ID || '';

  const apiMode =
    env.FRONTEND_API_MODE === 'direct' || env.FRONTEND_API_MODE === 'proxy'
      ? env.FRONTEND_API_MODE
      : env.VERCEL_ENV === 'preview'
        ? 'proxy'
        : 'proxy';

  const apiOrigin = (env.API_ORIGIN || 'http://localhost:11080').replace(/\/+$/, '');
  if (apiMode === 'direct' && !apiOrigin) {
    throw new Error('[build-env] direct 模式缺少 API_ORIGIN');
  }

  const apiBase = apiMode === 'direct' ? `${apiOrigin}/bff` : '/bff';
  const oauthBase = apiMode === 'direct' ? apiOrigin : '';
  const authBase = `https://auth.autional.${region}`;
  const consentBase = (env.VITE_CONSENT_BASE_URL || '/bff/ops/v1').replace(/\/+$/, '');
  const consentDevHeaders = env.VITE_CONSENT_DEV_HEADERS === '1';

  return {
    region,
    siteUrl,
    defaultLang,
    fallbackLang,
    oauthClientId,
    cdnHost,
    siteHost,
    rootDomain,
    apiMode,
    apiOrigin,
    apiBase,
    oauthBase,
    authBase,
    consentBase,
    consentDevHeaders,
  };
}
