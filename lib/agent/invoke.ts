import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import type { AgentAuthContext } from "./auth";
import { recordInvocation } from "./audit";
import { getTool } from "./tools/registry";

export interface InvokeToolOptions {
  auth: AgentAuthContext;
  source?: string;
  dryRun?: boolean;
  confirm?: boolean;
  idempotencyKey?: string;
  parentInvocationId?: string;
}

export interface InvokeToolResult {
  ok: boolean;
  output?: unknown;
  error?: { code: string; message: string };
  invocationId?: string;
  dryRun?: boolean;
}

/**
 * Unified Agent tool invocation pipeline.
 */
export async function invokeTool(
  name: string,
  input: unknown,
  options: InvokeToolOptions
): Promise<InvokeToolResult> {
  const startedAt = Date.now();
  const tool = getTool(name);
  if (!tool) {
    return { ok: false, error: { code: "tool_not_found", message: "工具不存在。" } };
  }

  const previous = options.idempotencyKey
    ? await prisma.agentToolInvocation.findUnique({
        where: { idempotencyKey_toolName: { idempotencyKey: options.idempotencyKey, toolName: name } }
      }).catch(() => null)
    : null;
  if (previous?.status === "success") {
    return {
      ok: true,
      output: JSON.parse(previous.outputJson),
      invocationId: previous.id
    };
  }

  try {
    const agentToolsEnabled = await isModuleEnabledForUser("agentTools", options.auth.user);
    if (!agentToolsEnabled) {
      throw new Error("Agent Tools 已被管理员关闭。");
    }

    if (options.auth.allowedTools?.length && !options.auth.allowedTools.includes(name)) {
      throw new Error("当前 API Key 未授权调用该工具。");
    }

    if (!can(options.auth.user.role, "useAgentTool")) {
      throw new Error("当前用户无 AI 工具调用权限。");
    }

    const allowed = tool.requiredPermissions.every((permission) => can(options.auth.user.role, permission));
    if (!allowed) {
      throw new Error("当前用户缺少工具所需权限。");
    }

    const parsedInput = tool.inputSchema.parse(input);
    if (tool.writeLevel === "dangerous" && !options.confirm) {
      const output = {
        preview: true,
        message: "该工具为危险写操作，请带 confirm=true 再次调用。",
        toolName: name,
        input: parsedInput
      };
      const invocationId = await recordInvocation({
        toolName: name,
        auth: options.auth,
        input: parsedInput,
        output,
        status: "dry_run",
        idempotencyKey: options.idempotencyKey,
        parentInvocationId: options.parentInvocationId,
        durationMs: Date.now() - startedAt
      });
      return { ok: true, output, invocationId, dryRun: true };
    }

    if (options.dryRun && tool.writeLevel !== "read") {
      const output = { preview: true, toolName: name, input: parsedInput };
      const invocationId = await recordInvocation({
        toolName: name,
        auth: options.auth,
        input: parsedInput,
        output,
        status: "dry_run",
        idempotencyKey: options.idempotencyKey,
        parentInvocationId: options.parentInvocationId,
        durationMs: Date.now() - startedAt
      });
      return { ok: true, output, invocationId, dryRun: true };
    }

    const output = await tool.handler(parsedInput as never, {
      user: options.auth.user,
      source: options.source ?? options.auth.source,
      dryRun: options.dryRun,
      confirm: options.confirm,
      parentInvocationId: options.parentInvocationId
    });
    const parsedOutput = tool.outputSchema.parse(output);
    const invocationId = await recordInvocation({
      toolName: name,
      auth: options.auth,
      input: parsedInput,
      output: parsedOutput,
      status: "success",
      idempotencyKey: options.idempotencyKey,
      parentInvocationId: options.parentInvocationId,
      durationMs: Date.now() - startedAt
    });

    return { ok: true, output: parsedOutput, invocationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "工具调用失败。";
    const invocationId = await recordInvocation({
      toolName: name,
      auth: options.auth,
      input,
      status: "error",
      errorMessage: message,
      idempotencyKey: options.idempotencyKey,
      parentInvocationId: options.parentInvocationId,
      durationMs: Date.now() - startedAt
    });
    return { ok: false, error: { code: "invoke_failed", message }, invocationId };
  }
}
