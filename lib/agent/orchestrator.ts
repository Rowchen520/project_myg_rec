import type { AgentAnalysis, AgentRiskDraft, AgentTaskDraft, Priority, RiskLevel } from "../types";

const roleKeywords = [
  { keyword: "界面", role: "Frontend" },
  { keyword: "dashboard", role: "Frontend" },
  { keyword: "看板", role: "Frontend" },
  { keyword: "接口", role: "Backend" },
  { keyword: "数据", role: "Backend" },
  { keyword: "部署", role: "QA/Ops" },
  { keyword: "测试", role: "QA/Ops" },
  { keyword: "需求", role: "Product" }
];

/**
 * Runs the local Agent workflow used when no external LLM provider is configured.
 */
export function runMockAgentWorkflow(input: string): AgentAnalysis {
  const normalized = input.trim();
  const segments = splitDemand(normalized);
  const tasks = segments.map((segment, index) => createTaskDraft(segment, index));
  const risks = detectRisks(normalized);

  return {
    productDefinition:
      normalized.length > 0
        ? `围绕"${normalized.slice(0, 80)}${normalized.length > 80 ? "..." : ""}"建立可验证的项目管理闭环。`
        : "请补充项目目标，系统会自动拆解产品目标、工作项、风险和下一步。",
    tasks,
    risks,
    progressReport: buildProgressReport(tasks, risks),
    nextActions: [
      "确认第一批 P0 工作项是否覆盖演示路径",
      "为阻塞工作项补充依赖和验收条件",
      "运行测试和构建后再进入部署阶段"
    ]
  };
}

/**
 * Splits a natural-language demand into implementation-sized work-package candidates.
 */
export function splitDemand(input: string): string[] {
  const cleanInput = input.trim();
  if (!cleanInput) {
    return ["补充项目目标", "定义验收标准", "创建第一批工作项"];
  }

  return cleanInput
    .split(/[，,。；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function createTaskDraft(segment: string, index: number): AgentTaskDraft {
  const role = roleKeywords.find((item) =>
    segment.toLocaleLowerCase().includes(item.keyword.toLocaleLowerCase())
  )?.role;
  const isMilestone = segment.includes("里程") || segment.includes("milestone") || segment.includes("发布");

  return {
    title: segment.length > 24 ? `${segment.slice(0, 24)}...` : segment,
    description: `根据对话输入拆解：${segment}`,
    priority: inferPriority(segment, index),
    assigneeRole: role ?? "Project",
    milestone: index < 2 ? "MVP Core" : "Automation",
    type: isMilestone ? "milestone" : "task"
  };
}

function inferPriority(segment: string, index: number): Priority {
  if (segment.includes("部署") || segment.includes("测试") || segment.includes("核心")) {
    return "P0";
  }

  if (index < 3) {
    return "P1";
  }

  return "P2";
}

function detectRisks(input: string): AgentRiskDraft[] {
  const risks: AgentRiskDraft[] = [];

  if (input.includes("无人") || input.includes("自动")) {
    risks.push({
      title: "无人值守边界需要持续验证",
      level: "Medium" as RiskLevel,
      impact: "自动开发、测试和部署如果缺少验收门禁，可能放大错误。",
      mitigation: "使用测试、构建、健康检查和可追溯日志作为门禁。"
    });
  }

  if (input.includes("部署") || input.includes("服务器")) {
    risks.push({
      title: "部署环境依赖外部凭据",
      level: "Medium" as RiskLevel,
      impact: "缺少 VPS、SSH 或环境变量时无法完成真实发布。",
      mitigation: "先交付 Docker 和 CI/CD 模板，再通过 GitHub Secrets 注入凭据。"
    });
  }

  if (risks.length === 0) {
    risks.push({
      title: "需求范围可能继续变化",
      level: "Low" as RiskLevel,
      impact: "范围变化会影响工作项优先级和里程碑。",
      mitigation: "通过 AI 管家定期重算风险、瓶颈和下一步。"
    });
  }

  return risks;
}

function buildProgressReport(tasks: AgentTaskDraft[], risks: AgentRiskDraft[]) {
  const p0Count = tasks.filter((task) => task.priority === "P0").length;
  const mediumOrHighRiskCount = risks.filter((risk) => risk.level !== "Low").length;

  return `已拆解 ${tasks.length} 个工作项，其中 ${p0Count} 个 P0；识别 ${mediumOrHighRiskCount} 个需要跟进的风险。`;
}
