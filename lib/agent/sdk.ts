import type { User } from "@/lib/types";
import { invokeTool, type InvokeToolResult } from "./invoke";

/**
 * Internal SDK entry for server-side AI helpers.
 */
export async function invokeAgentTool(
  name: string,
  input: unknown,
  options: {
    user: User;
    source?: string;
    dryRun?: boolean;
    confirm?: boolean;
    idempotencyKey?: string;
    parentInvocationId?: string;
  }
): Promise<InvokeToolResult> {
  return invokeTool(name, input, {
    auth: {
      user: options.user,
      source: "internal"
    },
    source: options.source ?? "internal",
    dryRun: options.dryRun,
    confirm: options.confirm,
    idempotencyKey: options.idempotencyKey,
    parentInvocationId: options.parentInvocationId
  });
}
