import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "blue" | "gray" | "green" | "amber";
};

const toneMap = {
  blue: "bg-brand-50 text-brand-700 border-brand-100",
  gray: "bg-slate-50 text-slate-700 border-slate-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100"
};

export function Badge({ children, tone = "gray" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneMap[tone]}`}>
      {children}
    </span>
  );
}
