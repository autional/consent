import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readBuildEnv } from '../../scripts/env.mjs';

const buildEnv = readBuildEnv();

/** 把 gen-env.mjs 生成的 public/env.js 内联进 index.html（避免被 SW/HTTP 缓存成旧值）。 */
function inlineEnvPlugin(): Plugin {
  return {
    name: 'inline-env-config',
    enforce: 'pre',
    transformIndexHtml(html) {
      const marker = /[ \t]*<script src="\/env\.js"><\/script>/;
      if (!marker.test(html)) {
        throw new Error('[consent] index.html 缺少 /env.js 脚本标记');
      }
      let envJs: string;
      try {
        envJs = readFileSync(path.resolve(__dirname, 'public/env.js'), 'utf8').trim();
      } catch {
        throw new Error('[consent] 缺少 public/env.js，请先运行 scripts/gen-env.mjs');
      }
      return html.replace(marker, `    <script>\n${envJs}\n    </script>`);
    },
  };
}

const proxy = {
  target: process.env.VITE_API_PROXY_URL || 'http://localhost:11080',
  changeOrigin: true,
};

export default defineConfig({
  plugins: [
    react(),
    inlineEnvPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'pwa',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        id: '/',
        name: 'Autional 高风险操作确认',
        short_name: 'Consent',
        description: '审批 Agent 发起的高风险动作',
        lang: buildEnv.defaultLang === 'zh' ? 'zh-CN' : 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/env.js', '**/apple-touch-icon.png', '**/icon*.svg'],
      },
      includeManifestIcons: false,
      devOptions: { enabled: false },
    }),
  ],
  define: {
    'import.meta.env.VITE_REGION': JSON.stringify(buildEnv.region),
    'import.meta.env.VITE_SITE_URL': JSON.stringify(buildEnv.siteUrl),
  },
  resolve: {
    extensions: ['.mjs', '.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 13113,
    proxy: { '/bff': proxy, '/oauth': proxy, '/api/v1': proxy },
  },
  preview: {
    port: 13113,
    proxy: { '/bff': proxy, '/oauth': proxy, '/api/v1': proxy },
  },
  build: { outDir: 'dist', sourcemap: false },
});
