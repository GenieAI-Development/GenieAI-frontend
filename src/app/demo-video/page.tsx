import Link from "next/link";
import { GenieMark } from "@/genie-ai/v3/Icon";

function getEmbedUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const id = trimmed.match(/\/file\/d\/([^/]+)/)?.[1] ?? trimmed.match(/[?&]id=([^&]+)/)?.[1];
  if (id) return `https://drive.google.com/file/d/${id}/preview`;

  const youtubeId =
    trimmed.match(/youtu\.be\/([^?&#/]+)/)?.[1] ??
    trimmed.match(/youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)([^?&#/]+)/)?.[1];
  return youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0` : trimmed;
}

const demoVideoPageUrl = "https://youtu.be/n0x_uYhJLwg";
const demoVideoUrl =
  getEmbedUrl(process.env.NEXT_PUBLIC_DEMO_VIDEO_EMBED_URL ?? "") ||
  getEmbedUrl(demoVideoPageUrl);

export default function DemoVideoPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F1] text-[#16202B] dark:bg-[#071A30] dark:text-[#EEF4FB]">
      <header className="border-b border-[#E4E1D8] bg-white dark:border-[#294967] dark:bg-[#102D4D]"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8"><Link href="/" className="flex items-center gap-2 text-[#0B2748] dark:text-white"><GenieMark className="h-8 w-8 shrink-0 rounded-[9px]" /><span className="genie-wordmark">Genie<span className="text-[#B3872F]">AI</span></span></Link><div className="flex gap-2"><Link href="/features" className="grid h-9 place-items-center rounded-full border border-[#D7E2EF] px-4 text-xs font-semibold text-[#31577F] dark:border-[#446583] dark:text-[#AFC8E5]">Features</Link><Link href="/" className="grid h-9 place-items-center rounded-full bg-[#0B2748] px-4 text-xs font-semibold text-white dark:bg-[#D6A936] dark:text-[#071A30]">Open GenieAI</Link></div></div></header>
      <section className="mx-auto grid max-w-6xl gap-7 px-5 py-10 md:px-8 md:py-16">
        <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#B3872F]">Product walkthrough</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-[#0B2748] dark:text-white md:text-6xl">Watch GenieAI in action.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[#5B6B7A] dark:text-[#AFC8E5]">See a shopping request become preference context, four product cards, comparison insights, a personalized gift message, and checkout preparation.</p></div>
        <section className="overflow-hidden rounded-[24px] border border-[#D7E2EF] bg-white shadow-[0_24px_60px_-30px_rgba(10,31,58,.45)] dark:border-[#294967] dark:bg-[#102D4D]">
          <div className="flex items-center justify-between border-b border-[#E4E1D8] px-4 py-3 dark:border-[#294967]"><div><p className="text-xs font-semibold text-[#0B2748] dark:text-white">GenieAI demo</p><p className="mt-0.5 text-[11px] text-[#5B6B7A] dark:text-[#AFC8E5]">Shopping workflow overview</p></div>{demoVideoUrl ? <Link href={demoVideoPageUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#D6A936] px-4 py-2 text-xs font-semibold text-[#071A30]">Open on YouTube</Link> : null}</div>
          <div className="aspect-video bg-[linear-gradient(135deg,#071A30,#1E4D8C_60%,#D6A936)] p-1.5">{demoVideoUrl ? <iframe src={demoVideoUrl} title="GenieAI demo video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full rounded-[18px] border-0 bg-black" /> : <div className="grid h-full place-items-center rounded-[18px] bg-[#FAF7F1] p-8 text-center dark:bg-[#0B2340]"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#D6A936] text-xl text-[#071A30]">▶</span><h2 className="mt-4 text-xl font-semibold text-[#0B2748] dark:text-white">Demo video is ready for your source</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#5B6B7A] dark:text-[#AFC8E5]">Set <code className="rounded bg-[#E7EEF7] px-1.5 py-1 text-xs dark:bg-[#163A60]">NEXT_PUBLIC_DEMO_VIDEO_EMBED_URL</code> to a Google Drive preview or embeddable video URL.</p></div></div>}</div>
        </section>
      </section>
    </main>
  );
}
