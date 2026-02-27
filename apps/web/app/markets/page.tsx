import { MarketsDashboard } from "../../components/markets-dashboard";

export default function MarketsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">Markets</h1>
        <p className="mt-1 text-sm text-slate-600">Daily candles with clean tooling for review and research.</p>
      </header>
      <MarketsDashboard />
    </div>
  );
}
