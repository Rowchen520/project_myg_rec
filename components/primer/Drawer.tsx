"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

export interface DrawerProps {
  title: ReactNode;
  description?: ReactNode;
  open: boolean;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Right-side detail pane used for split-screen work-package detail view.
 * Stays inline (not a modal) so it composes inside the table layout.
 */
export function Drawer({ title, description, open, onClose, actions, children }: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <aside className="surface" aria-label={typeof title === "string" ? title : "详情"}>
      <header className="surface__header">
        <div>
          <h2 className="section-title" style={{ fontSize: 18 }}>
            {title}
          </h2>
          {description ? <p className="section-subtitle">{description}</p> : null}
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          {actions}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭详情面板">
            关闭
          </Button>
        </div>
      </header>
      <div className="surface__body">{children}</div>
    </aside>
  );
}
