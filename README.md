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

### 本地演示（后端未实现时）

```bash
pnpm mock           # 内存 mock API，127.0.0.1:11080
pnpm dev
# 打开 http://localhost:13113/?demo=1
```

演示数据只有 3 条（R1/R2/R3），决策只改内存状态；重启 mock 即重置。

正式后端骨架：`shared/service-consent`（`go run ./cmd/server`；3 表 + 3 端点 + 审计 fail-closed）。网关路由/配置中心待接，当前 PWA 默认仍走 mock。

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

- `.cn` 项目 `cn-consent`（`prj_6Ib6WYGRtuWOvQBhKtj3ozPJOzLW`），`.com` 项目 `consent`（`prj_8QPYe7AUcuKh9poFaynEH6b0tJf8`）；同一仓、同一 `vercel.ts`，只换环境变量。
- 推 `main` 自动部署；CLI 重投按 `shared/entry-proxies/README.md`。
- `vercel.ts` 由 CLI 本地编译：命令环境与 Vercel 项目 env 都要有 `API_ORIGIN`。
- Hobby 下成员仓必须 public（ADR-017）。

## 部署状态（2026-11-09）

- GitHub：`https://github.com/autional/consent`，`main` 已推送。
- Vercel：两个项目均已创建并部署（`cn-consent` / `consent`），Production READY。
- `.com`：GoDaddy CNAME `consent -> 4f90496b90f22370.vercel-dns-017.com.`；证书已签发，`https://consent.autional.com` 200。
- `.cn`：DNSPod CNAME `consent -> 181a2b43c72b9f9d.vercel-dns-017.com.` 已配置；Vercel 证书已签发（CN=consent.autional.cn）；`https://consent.autional.cn` 200。
- OAuth：独立 client `client-9R0t08yqe4gF`（public；redirect `.cn/.com` + localhost；`cors_origins` 两域）；两区 authorize 探针均 302 → 各自 `/oauth/callback?error=login_required`。
- 两区 `env.js` 均已含 `VITE_OAUTH_CLIENT_ID=client-9R0t08yqe4gF`。
- `/`、`/env.js`、`/manifest.webmanifest`、`/sw.js`、`/oauth/callback`、`/c/<id>`（Accept html）均 200；缺失静态资源 404。
- 两区 Git 自动部署均可用（push `main` → 自动构建）；2026-11-09 手动 API 部署额度耗尽（100/天），不影响 Git 部署。
- API：两区 `FRONTEND_API_MODE=proxy`；若改 `direct`，CORS 已在 client 上登记两域。

## OAuth client

注册独立 client（不要复用 authenticator 的）：

- redirect：`https://consent.autional.cn/oauth/callback`、`https://consent.autional.com/oauth/callback`
- 若用 `direct`：把两个 consent 域写进 `oauth_clients.cors_origins`
- `VITE_OAUTH_CLIENT_ID` 指向该 client；缺省会回落到 authenticator 的 `01AR...0005`（错误）。
