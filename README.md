# consent · 高风险操作确认 PWA

`consent.autional.cn` / `consent.autional.com` 的唯一源站（双区单源，照 authenticator 的目录/发布模式）。

## 形态

- 单页 PWA（Vite + React + TypeScript）。
- 登录：平台 OIDC 授权码 + PKCE（`auth.autional.{cn,com}`）。
- 页面：`/` 待确认列表、`/c/:id` 确认详情、`/oauth/callback` 登录回调。
- API：`/bff/ops/v1/consents*`（Vercel rewrite → `API_ORIGIN`）。
- 不持有任何数据库/服务凭据；只展示与提交确认决定。

## 本地

```bash
pnpm install
pnpm dev            # http://localhost:13113
pnpm build
pnpm typecheck
pnpm test
```

本地默认 `REGION=cn`、`SITE_URL=https://consent.autional.cn`、`API_ORIGIN=http://localhost:11080`；生产构建（`VERCEL_ENV=production`）缺 `REGION/SITE_URL/API_ORIGIN/VITE_OAUTH_CLIENT_ID` 直接失败。

## 环境变量

| 变量 | 说明 |
|---|---|
| `REGION` | `cn` / `com` |
| `SITE_URL` | `https://consent.autional.cn` / `.com` |
| `API_ORIGIN` | `https://api.autional.cn` / `.com` |
| `VITE_OAUTH_CLIENT_ID` | consent 自己的 OAuth 公开 client id |
| `FRONTEND_API_MODE` | `proxy`（推荐）或 `direct`；direct 需服务端 CORS |
| `CDN_HOST` | `https://cdn.autional.cn` / `.com` |
| `DEFAULT_LANG` / `FALLBACK_LANG` | `zh` / `en` |

## Vercel

- `.cn` 项目 `cn-consent`，`.com` 项目 `consent`；同一仓、同一 `vercel.ts`，只换环境变量。
- 推 `main` 自动部署；CLI 重投按 `shared/entry-proxies/README.md`。
- `vercel.ts` 由 CLI 本地编译：命令环境与 Vercel 项目 env 都要有 `API_ORIGIN`。
- Hobby 下成员仓必须 public（ADR-017）。

## OAuth client

注册独立 client（不要复用 authenticator 的）：

- redirect：`https://consent.autional.cn/oauth/callback`、`https://consent.autional.com/oauth/callback`
- 若用 `direct`：把两个 consent 域写进 `oauth_clients.cors_origins`
- `VITE_OAUTH_CLIENT_ID` 指向该 client；缺省会回落到 authenticator 的 `01AR...0005`（错误）。
