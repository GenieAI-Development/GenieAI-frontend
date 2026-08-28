import Image from "next/image";
import Link from "next/link";

const features = [
  ["Smart Shopping", "Describe the recipient, occasion, budget, city, or gift type and get up to four live product suggestions."],
  ["Event Planner", "Build a guided checklist for birthdays, gatherings, and office events with focused next-step controls."],
  ["Gift Box", "Create a curated multi-item gift box around a recipient, theme, item count, occasion, and budget."],
  ["Product Compare", "Select two product cards and compare name, price, description, and up to four AI fit insights."],
  ["Gift Message", "Generate and refine an English gift message by size, tone, and your own suggestions."],
  ["Checkout", "Review the cart, delivery details, recipient information, saved gift message, and checkout link."],
];

const steps = [
  "Describe the gift or event in natural language.",
  "Set budget, recipient, occasion, gift type, and delivery preferences.",
  "Review four product suggestions, compare two options, and add products to the cart.",
  "Confirm the saved gift message and delivery details, then create the checkout link.",
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F1] text-[#16202B] dark:bg-[#071A30] dark:text-[#EEF4FB]">
      <header className="sticky top-0 z-20 border-b border-[#E4E1D8] bg-white/95 backdrop-blur dark:border-[#294967] dark:bg-[#102D4D]/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="genie-wordmark text-[#0B2748] dark:text-white">Genie<span className="text-[#B3872F]">AI</span></Link>
          <div className="flex gap-2">
            <Link href="/demo-video" className="grid h-9 place-items-center rounded-full border border-[#D7E2EF] px-4 text-xs font-semibold text-[#31577F] dark:border-[#446583] dark:text-[#AFC8E5]">Demo</Link>
            <Link href="/" className="grid h-9 place-items-center rounded-full bg-[#0B2748] px-4 text-xs font-semibold text-white dark:bg-[#D6A936] dark:text-[#071A30]">Open GenieAI</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-14 px-5 py-10 md:px-8 md:py-16">
        <section className="grid items-center gap-8 md:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#B3872F]">Features &amp; workflow</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-[#0B2748] dark:text-white md:text-6xl">Thoughtful shopping, guided from idea to checkout.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5B6B7A] dark:text-[#AFC8E5]">GenieAI combines conversational product discovery, event planning, gift-box building, comparison, message writing, and checkout preparation in one focused workspace.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/" className="rounded-[11px] bg-[#D6A936] px-5 py-3 text-sm font-semibold text-[#071A30]">Start shopping</Link><Link href="/demo-video" className="rounded-[11px] border border-[#D7E2EF] bg-white px-5 py-3 text-sm font-semibold text-[#31577F] dark:border-[#446583] dark:bg-[#102D4D] dark:text-[#AFC8E5]">Watch the demo</Link></div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-[#E6D5A7] bg-[radial-gradient(circle_at_50%_30%,#FFF8E7,#E7EEF7)] shadow-[0_24px_60px_-30px_rgba(10,31,58,.45)] dark:border-[#6F5727] dark:bg-[radial-gradient(circle_at_50%_30%,#332B1B,#102D4D)]"><Image src="/product-images/gift-box.svg" alt="Gift box" fill priority sizes="(min-width:768px) 38vw, 90vw" className="object-contain p-8" /></div>
        </section>

        <section><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#B3872F]">Everything in one place</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#0B2748] dark:text-white">Explore each GenieAI mode</h2><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{features.map(([title,text], index) => <article key={title} className="rounded-2xl border border-[#E4E1D8] bg-white p-5 shadow-[0_12px_32px_-26px_rgba(10,31,58,.35)] dark:border-[#294967] dark:bg-[#102D4D]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E7EEF7] text-xs font-bold text-[#1E4D8C] dark:bg-[#163A60] dark:text-[#8FC1F5]">{String(index + 1).padStart(2,"0")}</span><h3 className="mt-4 text-base font-semibold text-[#0B2748] dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-[#5B6B7A] dark:text-[#AFC8E5]">{text}</p></article>)}</div></section>

        <section className="grid gap-7 rounded-[24px] bg-[#0B2748] p-6 text-white md:grid-cols-[.7fr_1.3fr] md:p-8"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#D6A936]">How it works</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.03em]">From request to checkout</h2></div><ol className="grid gap-2.5">{steps.map((step,index) => <li key={step} className="grid grid-cols-[36px_1fr] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-[#D7E2EF]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#D6A936] font-bold text-[#071A30]">{index+1}</span>{step}</li>)}</ol></section>
      </div>
    </main>
  );
}
