import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "default"
  | "primary"
  | "accent"
  | "success"
  | "danger"
  | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * Primer-styled button. Uses the `.btn` token classes from globals.css so
 * the visual treatment stays consistent across the OpenProject layout.
 */
export function Button({
  variant = "default",
  size = "md",
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const composed = ["btn", className].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={composed}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
