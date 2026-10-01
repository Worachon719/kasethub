import { formatPricePerKg, formatThb } from "@/lib/utils";

export type TickerQuote = {
  id: string;
  label: string;
  pricePerKg: number;
  changePct: number;
};

/** Persistent 40px sub-header bar of real-time agricultural quotes. */
export function MarketTicker({ quotes }: { quotes: TickerQuote[] }) {
  return (
    <div className="glass sticky top-0 z-30 h-10 border-b border-hairline">
      <div className="mx-auto flex h-full max-w-canvas items-center gap-6 overflow-x-auto px-4 md:px-8">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
          ตลาดสด
        </span>
        {quotes.map((q) => {
          const up = q.changePct >= 0;
          return (
            <span
              key={q.id}
              className="flex shrink-0 items-center gap-2 text-xs text-ink-secondary"
            >
              <span className="font-semibold">{q.label}</span>
              <span className="tabular font-semibold text-ink">
                {formatPricePerKg(q.pricePerKg)}
              </span>
              <span
                className={`tabular font-bold ${up ? "text-emerald" : "text-critical-fg"}`}
              >
                {up ? "+" : ""}
                {q.changePct.toFixed(1)}%
              </span>
            </span>
          );
        })}
        <span className="ml-auto hidden shrink-0 text-[11px] text-ink-muted sm:inline">
          {formatThb(0).replace("0", "")}อัปเดตล่าสุด
        </span>
      </div>
    </div>
  );
}
