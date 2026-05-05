import type { z } from "zod";
import type { User } from "@/lib/types";

export type AgentToolWriteLevel = "read" | "write" | "dangerous";

export interface AgentToolContext {
  user: User;
  source: string;
  dryRun?: boolean;
  confirm?: boolean;
  parentInvocationId?: string;
}

export interface AgentToolDefinition<
  InputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  OutputSchema extends z.ZodTypeAny = z.ZodTypeAny
> {
  name: string;
  description: string;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  requiredPermissions: string[];
  writeLevel: AgentToolWriteLevel;
  handler: (input: z.infer<InputSchema>, ctx: AgentToolContext) => Promise<z.infer<OutputSchema>>;
}

export function defineTool<
  InputSchema extends z.ZodTypeAny,
  OutputSchema extends z.ZodTypeAny
>(definition: AgentToolDefinition<InputSchema, OutputSchema>) {
  return definition;
}
