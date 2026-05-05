import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/**
 * Lightweight empty-state placeholder used by lists and tables when no rows
 * match.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <strong className="empty-state__title">{title}</strong>
      {description ? <p style={{ margin: 0, fontSize: 13 }}>{description}</p> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}
