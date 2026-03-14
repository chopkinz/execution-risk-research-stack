import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
};

const styles = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 dark:bg-[var(--meridian-primary)] dark:hover:opacity-90",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-[var(--meridian-bg-paper)] dark:text-[var(--meridian-text-primary)] dark:border-[var(--meridian-divider)] dark:hover:bg-[var(--meridian-bg-default)]"
};

export function Button({
  children,
  href,
  onClick,
  disabled = false,
  variant = "primary",
  className = ""
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";
  const cls = `${base} ${styles[variant]} ${className}`.trim();

  if (href) {
    const isExternal = href.startsWith("http://") || href.startsWith("https://");
    if (isExternal) {
      return (
        <a href={href} className={cls} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
