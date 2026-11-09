#!/usr/bin/env node
/**
 * 生成 apps/consent-app/public/env.js 与 robots.txt（幂等，生成物不入库）。
 * 构建/开发前运行；缺失 env.js 时 inlineEnvPlugin 会 fail-closed。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBuildEnv } from './env.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const buildEnv = readBuildEnv();
const publicDir = join(root, 'apps', 'consent-app', 'public');

const write = (rel, content) => {
  const file = join(publicDir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const PORTALS = [
  ['consent', 'consent'],
  ['auth', 'auth'],
  ['user', 'user'],
  ['admin', 'admin'],
  ['platform', 'platform'],
  ['authenticator', 'authenticator'],
];
const portalConfig = PORTALS.map(
  ([name, host]) => `    ${name}: { host: "${host}", base: "" }`,
).join(',\n');

write(
  'env.js',
  `window.__APP_CONFIG__ = {
  VITE_REGION: "${buildEnv.region}",
  VITE_SITE_URL: "${buildEnv.siteUrl}",
  VITE_API_BASE_URL: "${buildEnv.apiBase}",
  VITE_OAUTH_BASE_URL: "${buildEnv.oauthBase}",
  VITE_AUTH_BASE_URL: "${buildEnv.authBase}",
  VITE_OAUTH_CLIENT_ID: "${buildEnv.oauthClientId}",
  VITE_CONSENT_BASE_URL: "${buildEnv.consentBase}",
  VITE_CDN_HOST: "${buildEnv.cdnHost}",
  VITE_COOKIE_DOMAIN: ".${buildEnv.rootDomain}",
  VITE_PORTAL_CONFIG: {
${portalConfig}
  }
};
`,
);

write(
  'robots.txt',
  `# ${buildEnv.siteHost}
User-agent: *
Allow: /
`,
);

console.log(`[gen-env] region=${buildEnv.region} site=${buildEnv.siteUrl} apiMode=${buildEnv.apiMode}`);
