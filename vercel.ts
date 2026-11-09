import { routes, type Rewrite, type VercelConfig } from '@vercel/config/v1';

/**
 * consent.autional.cn / consent.autional.com 的唯一源站（双区单源）。
 *
 * 上游 API origin 不写入本仓，取自 Vercel 项目环境变量 `API_ORIGIN`
 * （cn = https://api.autional.cn，com = https://api.autional.com）。
 * 未设置时故意抛错（fail-closed），避免静默产出坏路由。
 */
const rawOrigin = process.env.API_ORIGIN;

if (!rawOrigin) {
  throw new Error(
    '[consent] 缺少环境变量 API_ORIGIN（Vercel 项目设置里配置后重新部署）',
  );
}

const ORIGIN = rawOrigin.replace(/\/+$/, '');

const NO_CACHE = 'public, max-age=0, must-revalidate';
const IMMUTABLE = 'public, max-age=31536000, immutable';

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
];

const spaFallback: Rewrite = {
  source: '/(.*)',
  destination: '/index.html',
  has: [{ type: 'header', key: 'accept', value: { re: 'text/html' } }],
};

export const config: VercelConfig = {
  framework: 'vite',
  installCommand: 'pnpm install --frozen-lockfile',
  buildCommand: 'pnpm --filter @autional/consent-app... build',
  outputDirectory: 'apps/consent-app/dist',
  headers: [
    routes.header('/(.*)', SECURITY_HEADERS),
    routes.header('/assets/(.*)', [{ key: 'Cache-Control', value: IMMUTABLE }]),
    routes.header('/workbox-(.*).js', [{ key: 'Cache-Control', value: IMMUTABLE }]),
    routes.header('/', [{ key: 'Cache-Control', value: NO_CACHE }]),
    routes.header('/index.html', [{ key: 'Cache-Control', value: NO_CACHE }]),
    routes.header('/sw.js', [{ key: 'Cache-Control', value: NO_CACHE }]),
    routes.header('/registerSW.js', [{ key: 'Cache-Control', value: NO_CACHE }]),
    routes.header('/manifest.webmanifest', [{ key: 'Cache-Control', value: NO_CACHE }]),
    routes.header('/env.js', [{ key: 'Cache-Control', value: NO_CACHE }]),
  ],
  rewrites: [
    routes.rewrite('/bff/:path*', `${ORIGIN}/bff/:path*`),
    routes.rewrite('/api/v1/:path*', `${ORIGIN}/api/v1/:path*`),
    routes.rewrite('/oauth/callback', '/index.html'),
    routes.rewrite('/oauth/:path*', `${ORIGIN}/oauth/:path*`),
    spaFallback,
  ],
};
