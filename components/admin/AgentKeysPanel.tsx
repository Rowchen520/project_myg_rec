"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import type { User } from "@/lib/types";

interface AgentKeysPanelProps {
  currentUser?: User;
  keys: Array<{
    id: string;
    name: string;
    keyPrefix: string;
    revokedAt: Date | null;
    createdAt: Date;
  }>;
}

/**
 * Admin UI for issuing and revoking Agent API Keys.
 */
export function AgentKeysPanel({ currentUser, keys }: AgentKeysPanelProps) {
  const router = useRouter();
  const [name, setName] = useState("自动化客户端");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createKey() {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ name })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建 API Key 失败。");
      }
      const payload = (await response.json()) as { key: { secret: string } };
      setSecret(payload.key.secret);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建 API Key 失败。");
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    if (!currentUser) return;
    setBusy(true);
    await fetch(`/api/agent/api-keys?id=${id}`, {
      method: "DELETE",
      headers: { "x-user-id": currentUser.id }
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
        <Button variant="primary" disabled={busy || !name.trim()} onClick={createKey}>
          颁发 Key
        </Button>
      </div>
      {secret ? (
        <p className="hint mono" style={{ wordBreak: "break-all" }}>
          明文仅显示一次：{secret}
        </p>
      ) : null}
      {error ? <p style={{ color: "var(--danger-fg)", margin: 0 }}>{error}</p> : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>前缀</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <td>{key.name}</td>
              <td className="mono">{key.keyPrefix}</td>
              <td>{key.revokedAt ? "已撤销" : "有效"}</td>
              <td>
                {!key.revokedAt ? (
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => revokeKey(key.id)}>
                    撤销
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
