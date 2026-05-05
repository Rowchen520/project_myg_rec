import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Lightweight breadcrumb used at the top of every content page.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  const lastIndex = items.length - 1;

  return (
    <nav aria-label="面包屑" className="breadcrumb">
      {items.map((item, index) => (
        <Fragment key={`${index}-${typeof item.label === "string" ? item.label : index}`}>
          {item.href && index !== lastIndex ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className={index === lastIndex ? "breadcrumb__current" : undefined}>
              {item.label}
            </span>
          )}
          {index !== lastIndex ? (
            <span className="breadcrumb__separator" aria-hidden="true">
              /
            </span>
          ) : null}
        </Fragment>
      ))}
    </nav>
  );
}
