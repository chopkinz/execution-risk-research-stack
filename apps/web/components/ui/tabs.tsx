"use client";

type TabOption = {
  id: string;
  label: string;
};

type TabsProps = {
  options: TabOption[];
  active: string;
  onChange: (id: string) => void;
};

export function Tabs({ options, active, onChange }: TabsProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-[var(--meridian-divider)] dark:bg-[var(--meridian-bg-default)]">
      {options.map((option) => {
        const selected = option.id === active;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              selected
                ? "bg-white text-slate-900 shadow-sm dark:bg-[var(--meridian-bg-paper)] dark:text-[var(--meridian-text-primary)]"
                : "text-slate-600 hover:text-slate-800 dark:text-[var(--meridian-text-secondary)] dark:hover:text-[var(--meridian-text-primary)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
