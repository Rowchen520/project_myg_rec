import { prisma } from "@/lib/prisma";
import type { AgentAuthContext } from "./auth";

export interface AgentAuditInput {
  toolName: string;
  auth: AgentAuthContext;
  input: unknown;
  output?: unknown;
  status: "success" | "error" | "dry_run";
  errorMessage?: string;
  idempotencyKey?: string;
  parentInvocationId?: string;
  durationMs: number;
}

/**
 * Records one Agent tool invocation. Logging failures should not hide the real result.
 */
export async function recordInvocation(input: AgentAuditInput): Promise<string | undefined> {
  try {
    const created = await prisma.agentToolInvocation.create({
      data: {
        toolName: input.toolName,
        callerUserId: input.auth.user.id,
        callerApiKeyId: input.auth.apiKeyId,
        source: input.auth.source,
        inputJson: JSON.stringify(input.input ?? {}),
        outputJson: JSON.stringify(input.output ?? {}),
        status: input.status,
        errorMessage: input.errorMessage,
        idempotencyKey: input.idempotencyKey,
        parentInvocationId: input.parentInvocationId,
        durationMs: input.durationMs
      }
    });
    return created.id;
  } catch {
    return undefined;
  }
}
