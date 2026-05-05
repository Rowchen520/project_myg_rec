"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primer/Button";
import { Select } from "@/components/primer/Select";
import { roleLabels } from "@/lib/rbac";
import type { PlatformFeatureFlagDto } from "@/lib/services/feature-flags";
import type { PlatformRole, User } from "@/lib/types";

interface FeatureFlagsTableProps {
  flags: PlatformFeatureFlagDto[];
  currentUser?: User;
}

const ROLES: PlatformRole[] = ["admin", "projectManager", "participant"];

/**
 * Admin table for site and role-level platform module switches.
 */
export function FeatureFlagsTable({ flags, currentUser }: FeatureFlagsTableProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = currentUser?.role === "admin";

  async function patchFlag(flag: PlatformFeatureFlagDto, patch: Partial<PlatformFeatureFlagDto>) {
    if (!currentUser) {
      return;
    }

    setBusyKey(flag.key);
    setError(null);
    try {
      const response = await fetch("/api/feature-flags", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({
          key: flag.key,
          siteEnabled: patch.siteEnabled,
          roleOverrides: patch.roleOverrides
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "保存模块开关失败。");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存模块开关失败。");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}
      <div className="scroll-x">
        <table className="data-table" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>模块</th>
              <th>说明</th>
              <th>站点开关</th>
              {ROLES.map((role) => (
                <th key={role}>{roleLabels[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.key}>
                <td className="mono">{flag.key}</td>
                <td className="hint">{flag.description}</td>
                <td>
                  <Button
                    size="sm"
                    variant={flag.siteEnabled ? "success" : "default"}
                    disabled={!canEdit || busyKey === flag.key}
                    onClick={() => patchFlag(flag, { siteEnabled: !flag.siteEnabled })}
                  >
                    {flag.siteEnabled ? "已启用" : "已关闭"}
                  </Button>
                </td>
                {ROLES.map((role) => (
                  <td key={role}>
                    <Select
                      value={String(flag.roleOverrides[role] ?? true)}
                      disabled={!canEdit || busyKey === flag.key}
                      onChange={(event) =>
                        patchFlag(flag, {
                          roleOverrides: {
                            ...flag.roleOverrides,
                            [role]: event.target.value === "true"
                          }
                        })
                      }
                    >
                      <option value="true">允许</option>
                      <option value="false">隐藏</option>
                    </Select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canEdit ? <p className="hint">当前账号只读，只有管理员可以修改模块开关。</p> : null}
    </div>
  );
}
