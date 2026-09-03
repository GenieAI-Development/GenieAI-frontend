import { useState } from "react";
import type { GenieProduct } from "./types";
import { V3Icon } from "./Icon";

type MatchResult = {
  overallScore: number;
  overallSummary: string;
  recommendations: string[];
};

export function ProductMatchDialog({ items }: { items: GenieProduct[] }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);

  async function checkMatch() {
    setOpen(true);
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/product-matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: items.map(({ id, name, category, description }) => ({ id, name, category, description })) }),
      });
      const data = (await response.json()) as MatchResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to check product matching.");
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to check product matching.");
    } finally {
      setChecking(false);
    }
  }

  return <>
    <button type="button" disabled={items.length < 2 || checking} onClick={() => void checkMatch()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#C89B3C] px-4 py-3 text-sm font-bold text-[#F2D58A] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"><V3Icon name="sparkles" className="h-4 w-4" />{checking ? "Checking your products…" : "Check product match"}</button>
    {items.length < 2 ? <p className="mt-2 text-center text-xs leading-5 text-white/70">Add at least two products to check how well they match.</p> : null}

    {open ? <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <button type="button" aria-label="Close product matching insights" onClick={() => !checking && setOpen(false)} className="absolute inset-0 bg-[#0A1F3A]/55 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" aria-labelledby="match-insights-title" className="relative z-10 max-h-[85vh] w-full max-w-[620px] overflow-y-auto rounded-[22px] bg-white p-5 text-[#0A1F3A] shadow-[0_24px_70px_rgba(10,31,58,.35)] sm:p-7">
        <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#B3872F]">AI cart analysis</p><h2 id="match-insights-title" className="mt-1 font-serif text-2xl font-bold">Product matching insights</h2></div><button type="button" disabled={checking} onClick={() => setOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#E4E1D8] text-[#3E4A56] disabled:opacity-40" aria-label="Close"><V3Icon name="x" className="h-4 w-4" /></button></header>
        {checking ? <div className="grid min-h-52 place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 animate-pulse place-items-center rounded-full bg-[#FFF3D6] text-[#B3872F]"><V3Icon name="sparkles" className="h-6 w-6" /></span><p className="mt-4 text-sm font-semibold">Reviewing your gift bundle…</p></div></div> : null}
        {error ? <div className="mt-6 rounded-xl border border-[#E8C9BB] bg-[#FFF6F1] p-4 text-sm leading-6 text-[#9B4529]"><p>{error}</p><button type="button" onClick={() => void checkMatch()} className="mt-3 rounded-lg bg-[#0A1F3A] px-4 py-2 text-xs font-bold text-white">Try again</button></div> : null}
        {result ? <div className="mt-6 space-y-5">
          <div className="rounded-2xl bg-[#F5F8FC] p-4 sm:flex sm:items-center sm:gap-5"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[7px] border-[#C89B3C] bg-white font-serif text-xl font-bold">{result.overallScore}%</div><div className="mt-3 sm:mt-0"><h3 className="text-sm font-bold">Overall bundle fit</h3><p className="mt-1 text-xs leading-5 text-[#5B6B7A]">{result.overallSummary}</p></div></div>
          {result.recommendations.length ? <div className="rounded-xl bg-[#FFF8E7] p-4"><h3 className="flex items-center gap-2 text-xs font-bold text-[#7A5A18]"><V3Icon name="sparkles" className="h-4 w-4" />Ways to improve the bundle</h3><ul className="mt-2 space-y-1.5 text-xs leading-5 text-[#715F3B]">{result.recommendations.map((item) => <li key={item}>• {item}</li>)}</ul></div> : null}
        </div> : null}
      </section>
    </div> : null}
  </>;
}
