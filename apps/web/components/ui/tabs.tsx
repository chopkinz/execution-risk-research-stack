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
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
      {options.map((option) => {
        const selected = option.id === active;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
