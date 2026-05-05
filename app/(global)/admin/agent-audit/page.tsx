import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AgentAuditView } from "@/components/admin/AgentAuditView";
import { Surface } from "@/components/primer/Surface";
import { prisma } from "@/lib/prisma";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function AgentAuditPage() {
  const { currentUser } = await getShellRequestContext();
  const invocations = await prisma.agentToolInvocation.findMany({
    where: currentUser?.role === "admin" ? undefined : { callerUserId: currentUser?.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <>
      <Breadcrumb items={[{ label: "管理员", href: "/admin" }, { label: "Agent 调用审计" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">Agent 调用审计</h1>
          <p className="page-subtitle">查看 Tool Registry 统一管道记录的调用、失败和 dry-run。</p>
        </div>
      </header>
      <Surface title="最近调用" flush>
        <AgentAuditView invocations={invocations} />
      </Surface>
    </>
  );
}
