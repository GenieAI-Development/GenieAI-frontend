import Link from "next/link";
import { GenieMark, V3Icon } from "./Icon";

const highlights = [
  ["shopping", "Smart Shopping", "Four live product suggestions"],
  ["compare", "Compare", "Clear side-by-side insights"],
  ["gift", "Gift Message", "Personalized English notes"],
];

export function WelcomePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-[#071A30]/45 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="genie-welcome-panel relative w-full overflow-hidden rounded-b-[28px] border-b border-[#D6A936] bg-[#FAF7F1] shadow-[0_24px_70px_rgba(7,26,48,.38)] dark:bg-[#071A30]">
        <div className="pointer-events-none absolute -right-24 -top-36 h-80 w-80 rounded-full bg-[#D6A936]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-[#3D74B8]/15 blur-3xl" />
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-[#D7E2EF] bg-white text-[#31577F] shadow-sm transition hover:bg-[#E7EEF7] dark:border-[#294967] dark:bg-[#102D4D] dark:text-[#AFC8E5]" aria-label="Close welcome panel"><V3Icon name="x" className="h-4 w-4" /></button>

        <div className="relative mx-auto grid min-h-[430px] w-full max-w-6xl items-center gap-8 px-6 py-12 md:grid-cols-[1.08fr_.92fr] md:px-10 md:py-14">
          <div>
            <div className="flex items-center gap-3"><GenieMark className="h-10 w-10 rounded-xl border border-[#D6A936]" /><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#B3872F]">Welcome to GenieAI</p><p className="mt-0.5 text-xs font-medium text-[#5B6B7A] dark:text-[#AFC8E5]">Your guided gifting workspace</p></div></div>
            <h2 id="welcome-title" className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-[#0B2748] dark:text-white md:text-6xl">Find something thoughtful, without the endless searching.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#5B6B7A] dark:text-[#AFC8E5] md:text-base">Tell Genie who you are shopping for. It will shape the search, compare the strongest options, save your message for checkout, and guide you through delivery.</p>
            <div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={onClose} className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-[#0B2748] px-5 text-sm font-semibold text-white transition hover:bg-[#123661] dark:bg-[#D6A936] dark:text-[#071A30]">Start shopping<V3Icon name="send" className="h-4 w-4" /></button><Link href="/features" className="grid h-11 place-items-center rounded-[11px] border border-[#D7E2EF] bg-white px-5 text-sm font-semibold text-[#31577F] dark:border-[#294967] dark:bg-[#102D4D] dark:text-[#AFC8E5]">Explore features</Link></div>
          </div>

          <div className="rounded-[22px] border border-[#D7E2EF] bg-white/90 p-3 shadow-[0_20px_50px_-32px_rgba(10,31,58,.5)] backdrop-blur dark:border-[#294967] dark:bg-[#102D4D]/90">
            <div className="rounded-2xl bg-[#0B2748] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#D6A936]">One conversation</p><h3 className="mt-2 text-xl font-semibold">From idea to checkout</h3><p className="mt-2 text-sm leading-6 text-[#AFC8E5]">Use natural language, quick preferences, voice, or an image to begin.</p></div>
            <div className="mt-2 grid gap-2">{highlights.map(([icon,title,text]) => <div key={title} className="grid grid-cols-[38px_1fr] items-center gap-3 rounded-xl bg-[#FAF7F1] p-3 dark:bg-[#0B2340]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#E7EEF7] text-[#1E4D8C] dark:bg-[#163A60] dark:text-[#8FC1F5]"><V3Icon name={icon} className="h-[18px] w-[18px]" /></span><div><p className="text-sm font-semibold text-[#0B2748] dark:text-white">{title}</p><p className="mt-0.5 text-xs text-[#5B6B7A] dark:text-[#AFC8E5]">{text}</p></div></div>)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
