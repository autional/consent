#!/usr/bin/env node
/**
 * PWA 预缓存守卫（简化版）：
 * - VitePWA 有 manifest.icons 时必须 includeManifestIcons: false；
 * - globIgnores 最好排除 apple-touch-icon.png（只告警）；
 * - 用了 cdnHeadPlugin 时 index.html 必须有 <!-- preconnect:cdn -->。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const configPath = join(cwd, 'vite.config.ts');
const indexPath = join(cwd, 'index.html');

if (!existsSync(configPath)) {
  console.error(`[check-pwa] 未找到 ${configPath}（需在 apps/<app>/ 目录下运行）`);
  process.exit(1);
}

const config = readFileSync(configPath, 'utf8');
const errors = [];
const warnings = [];

if (config.includes('VitePWA(')) {
  const hasManifestIcons = /manifest:\s*\{[\s\S]*?icons:\s*\[/.test(config);
  const hasDisabled = /includeManifestIcons:\s*false/.test(config);
  if (hasManifestIcons && !hasDisabled) {
    errors.push('manifest.icons 存在但未设 includeManifestIcons: false');
  }
  if (hasManifestIcons && !/globIgnores:\s*\[[\s\S]*?apple-touch-icon/.test(config)) {
    warnings.push('globIgnores 未排除 **/apple-touch-icon.png');
  }
}

if (config.includes('cdnHeadPlugin')) {
  if (!existsSync(indexPath)) {
    errors.push('用了 cdnHeadPlugin 但缺少 index.html');
  } else if (!readFileSync(indexPath, 'utf8').includes('<!-- preconnect:cdn -->')) {
    errors.push('用了 cdnHeadPlugin 但 index.html 缺少 <!-- preconnect:cdn -->');
  }
}

for (const warning of warnings) console.warn(`[check-pwa] warn: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`[check-pwa] error: ${error}`);
  process.exit(1);
}
console.log('[check-pwa] ok');
