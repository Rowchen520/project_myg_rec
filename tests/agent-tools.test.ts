import { describe, expect, it } from "vitest";
import { listTools, serializeTool } from "@/lib/agent/tools/registry";

describe("agent tool registry", () => {
  it("registers the initial documented tool set", () => {
    const tools = listTools();
    const names = tools.map((tool) => tool.name);

    expect(tools).toHaveLength(17);
    expect(names).toContain("project.list");
    expect(names).toContain("workPackage.create");
    expect(names).toContain("agent.breakdown.confirm");
    expect(names).toContain("overview.snapshot");
  });

  it("serializes tool metadata with json schemas", () => {
    const tool = listTools().find((item) => item.name === "workPackage.create");
    expect(tool).toBeDefined();

    const serialized = serializeTool(tool!);
    expect(serialized.writeLevel).toBe("write");
    expect(serialized.inputSchema).toBeDefined();
    expect(serialized.outputSchema).toBeDefined();
  });
});
