import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AgentKeysPanel } from "@/components/admin/AgentKeysPanel";
import { Surface } from "@/components/primer/Surface";
import { prisma } from "@/lib/prisma";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function AgentKeysPage() {
  const { currentUser } = await getShellRequestContext();
  const keys = await prisma.agentApiKey.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <Breadcrumb items={[{ label: "管理员", href: "/admin" }, { label: "Agent API Key" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">Agent API Key</h1>
          <p className="page-subtitle">颁发和撤销非交互式 AI 客户端使用的 API Key。</p>
        </div>
      </header>
      <Surface title="密钥管理">
        <AgentKeysPanel currentUser={currentUser} keys={keys} />
      </Surface>
    </>
  );
}
