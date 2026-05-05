# MCP 预留契约

本阶段仅保留 MCP 契约和占位入口，不接入真实 Tool Registry。

## stdio

`scripts/mcp-server.ts` 执行后输出：

```text
MCP server is reserved but not implemented in this phase. See docs/agent/mcp-spec.md
```

## Streamable HTTP

`/api/mcp/[transport]` 对 `GET` / `POST` 返回：

```json
{
  "error": "not_implemented",
  "seeAlso": "/docs/agent/mcp-spec.md"
}
```

状态码为 `501`。

## 未来映射

- `ListTools`：由 `lib/agent/tools/registry.ts` 派生工具 schema。
- `CallTool`：映射到 `lib/agent/invoke.ts`。
- `Resources`：建议使用 `myg://project/<id>`、`myg://work-package/<id>`。
- 鉴权：沿用 REST `Authorization: Bearer <AgentApiKey>`。
