interface AgentAuditViewProps {
  invocations: Array<{
    id: string;
    toolName: string;
    status: string;
    source: string;
    durationMs: number;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}

/**
 * Read-only table of recent Agent tool invocations.
 */
export function AgentAuditView({ invocations }: AgentAuditViewProps) {
  return (
    <div className="scroll-x">
      <table className="data-table" style={{ minWidth: 820 }}>
        <thead>
          <tr>
            <th>时间</th>
            <th>工具</th>
            <th>来源</th>
            <th>状态</th>
            <th>耗时</th>
            <th>错误</th>
          </tr>
        </thead>
        <tbody>
          {invocations.map((item) => (
            <tr key={item.id}>
              <td className="mono">{item.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td>{item.toolName}</td>
              <td>{item.source}</td>
              <td>{item.status}</td>
              <td>{item.durationMs}ms</td>
              <td className="hint">{item.errorMessage ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
