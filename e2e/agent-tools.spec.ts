import { expect, test } from "@playwright/test";

test.describe("agent tools", () => {
  test("lists tools and invokes overview snapshot", async ({ request }) => {
    const toolsResponse = await request.get("/api/agent/tools", {
      headers: { "x-user-id": "u-admin" }
    });
    expect(toolsResponse.ok()).toBe(true);
    const toolsPayload = (await toolsResponse.json()) as { tools: Array<{ name: string }> };
    expect(toolsPayload.tools.some((tool) => tool.name === "overview.snapshot")).toBe(true);

    const invokeResponse = await request.post("/api/agent/invoke", {
      headers: {
        "x-user-id": "u-admin",
        "Idempotency-Key": `e2e-overview-${Date.now()}`
      },
      data: { name: "overview.snapshot", input: {} }
    });
    expect(invokeResponse.ok()).toBe(true);
    const invokePayload = (await invokeResponse.json()) as { ok: boolean; output: { global: unknown } };
    expect(invokePayload.ok).toBe(true);
    expect(invokePayload.output.global).toBeDefined();
  });

  test("dangerous tools require confirm and MCP route is reserved", async ({ request }) => {
    const dryRun = await request.post("/api/agent/invoke", {
      headers: { "x-user-id": "u-admin" },
      data: { name: "project.archive", input: { projectId: "proj-ai-pm" } }
    });
    expect(dryRun.ok()).toBe(true);
    const dryRunPayload = (await dryRun.json()) as { dryRun?: boolean };
    expect(dryRunPayload.dryRun).toBe(true);

    const mcp = await request.post("/api/mcp/streamable-http", { data: {} });
    expect(mcp.status()).toBe(501);
  });
});
