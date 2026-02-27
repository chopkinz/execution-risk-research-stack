import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, subtitle, right, children, className = "" }: PanelProps) {
  return (
    <section className={`card p-4 md:p-5 ${className}`.trim()}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="panel-title">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
