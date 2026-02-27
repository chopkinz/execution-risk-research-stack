type StatTileProps = {
  label: string;
  value: string;
  hint?: string;
};

export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="card p-4">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
