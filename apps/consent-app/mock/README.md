# Consent API 本地 mock

真后端 `service-consent` 未实现前，用这个内存 mock 跑通 PWA：

```bash
# 1) 起 mock API
pnpm mock

# 2) 起前端（Vite 已把 /bff 代理到 :11080）
pnpm dev

# 3) 浏览器打开演示模式
#    http://localhost:13113/?demo=1
```

- 数据在内存里，重启即重置；决策会改状态。
- 只用于本地演示/联调，不是生产后端。
- 真实契约见 `docs/OPS-AGENT-ACCESS-DESIGN.md` §7–§8：
  - `GET /ops/v1/consents?status=pending`
  - `GET /ops/v1/consents/:id`
  - `POST /ops/v1/consents/:id/decision` `{decision:"approved"|"rejected"}`
- 生产要求：JWT + 租户/角色门禁、`params_hash` 绑定、一次性决策、审计 fail-closed。
