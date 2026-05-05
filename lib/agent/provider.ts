import { runMockAgentWorkflow } from "./orchestrator";
import type { AgentAnalysis } from "../types";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Analyzes a project prompt with a pluggable provider.
 */
export async function analyzeWithProvider(prompt: string): Promise<AgentAnalysis> {
  if (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    const remoteAnalysis = await tryOpenAICompatibleProvider(prompt);
    if (remoteAnalysis) {
      return remoteAnalysis;
    }
  }

  return runMockAgentWorkflow(prompt);
}

async function tryOpenAICompatibleProvider(prompt: string): Promise<AgentAnalysis | null> {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是项目管理平台的 AI 管家。请返回 JSON，字段包括 productDefinition、tasks、risks、progressReport、nextActions。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    return normalizeAnalysis(JSON.parse(content));
  } catch {
    return null;
  }
}

function normalizeAnalysis(value: unknown): AgentAnalysis | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const analysis = value as Partial<AgentAnalysis>;
  if (!analysis.productDefinition || !Array.isArray(analysis.tasks)) {
    return null;
  }

  return {
    productDefinition: String(analysis.productDefinition),
    tasks: analysis.tasks,
    risks: Array.isArray(analysis.risks) ? analysis.risks : [],
    progressReport: String(analysis.progressReport ?? ""),
    nextActions: Array.isArray(analysis.nextActions) ? analysis.nextActions.map(String) : []
  };
}
