import type { ReactNode } from "react";

export interface SurfaceProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes vertical padding from the body so tables can sit flush. */
  flush?: boolean;
  /** Removes only horizontal padding from the body. */
  flushX?: boolean;
}

/**
 * Bordered surface used to group content into a card. Provides optional
 * header (title + description + actions) and footer slots, and supports
 * `flush` / `flushX` for layouts that need the inner content to span the
 * full width (e.g. tables).
 */
export function Surface({
  title,
  description,
  actions,
  footer,
  children,
  className,
  flush,
  flushX
}: SurfaceProps) {
  const composed = ["surface", className].filter(Boolean).join(" ");

  return (
    <section
      className={composed}
      data-flush={flush ? "true" : undefined}
      data-flush-x={flushX ? "true" : undefined}
    >
      {title || description || actions ? (
        <header className="surface__header">
          <div className="surface__header-inner">
            {title ? <h2 className="section-title">{title}</h2> : null}
            {description ? <p className="section-subtitle">{description}</p> : null}
          </div>
          {actions ? (
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className="surface__body">{children}</div>
      {footer ? <footer className="surface__footer">{footer}</footer> : null}
    </section>
  );
}
