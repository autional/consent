/// <reference types="vite/client" />

type PortalEntry = { host: string; base: string };

interface AppConfig {
  VITE_REGION: 'cn' | 'com';
  VITE_SITE_URL: string;
  VITE_API_BASE_URL: string;
  VITE_OAUTH_BASE_URL: string;
  VITE_AUTH_BASE_URL: string;
  VITE_OAUTH_CLIENT_ID: string;
  VITE_CDN_HOST: string;
  VITE_COOKIE_DOMAIN: string;
  VITE_PORTAL_CONFIG: Record<string, PortalEntry>;
}

interface Window {
  __APP_CONFIG__: AppConfig;
}
