"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import type { GenieLanguage, GenieProduct } from "./types";
import { V3Icon } from "./Icon";

export type GiftCardPreferences = {
  instructions: string;
  language: GenieLanguage;
  occasion: string;
  recipient: string;
  receiverName: string;
  senderName: string;
  style: string;
  theme: string;
};

type Props = {
  analysis: string;
  generatedImage: string;
  generating: boolean;
  languageLabels: Record<GenieLanguage, string>;
  languageOptions: GenieLanguage[];
  message: string;
  onPreferences: (preferences: GiftCardPreferences) => void;
  onProduct: (productId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  palette: string[];
  preferences: GiftCardPreferences;
  products: GenieProduct[];
  selectedProductId: string;
};

const fieldClass = "h-10 w-full min-w-0 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]";

export function GiftCardTool(props: Props) {
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const selectedProduct = props.products.find((product) => product.id === props.selectedProductId);
  const update = <Key extends keyof GiftCardPreferences>(key: Key, value: GiftCardPreferences[Key]) => {
    props.onPreferences({ ...props.preferences, [key]: value });
  };

  return (
    <div className="grid min-h-0 gap-3 lg:h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <section className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-[#D7E2EF] bg-white shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]">
        <div className="flex items-center justify-between gap-3 bg-[#0B2748] px-5 py-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#D6A936]">Image generator</p><h2 className="mt-1 text-xl font-semibold text-white">Gift Card</h2></div>
          {props.generatedImage ? <a href={props.generatedImage} download="genieai-gift-card.svg" className="flex h-9 items-center gap-2 rounded-[10px] border border-white/20 px-3 text-xs font-semibold text-white transition hover:bg-white/10"><V3Icon name="download" className="h-4 w-4" />Download</a> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-[#FAF7F1] p-4">
          {props.generatedImage ? (
            <div className="grid min-h-0 flex-1 content-start gap-3">
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-[#D7E2EF] bg-white shadow-sm">
                <Image src={props.generatedImage} alt="Generated gift card" fill unoptimized sizes="(min-width: 1024px) 56vw, 92vw" className="object-contain" />
              </div>
              <div className="grid gap-2 rounded-xl border border-[#D7E2EF] bg-white p-3">
                <div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8A6823]">Matched palette</span>{props.palette.map((color) => <span key={color} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: color }} title={color} />)}</div>
                <p className="text-xs leading-5 text-[#5B6B7A]">{props.analysis}</p>
                <p className="text-sm font-medium leading-6 text-[#0B2748]">{props.message}</p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[280px] flex-1 place-items-center rounded-xl border border-dashed border-[#C8D5E3] bg-white px-6 text-center">
              <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#E7EEF7] text-[#1E4D8C]"><V3Icon name="card" className="h-6 w-6" /></span><h3 className="mt-3 text-base font-semibold text-[#0B2748]">Your generated card appears here</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#5B6B7A]">Choose a product from the cart and set the preferences. GenieAI will analyze the product image and match its colors, theme, and context.</p></div>
            </div>
          )}
        </div>
      </section>

      <form onSubmit={props.onSubmit} className="grid min-w-0 content-start gap-3 overflow-y-auto rounded-2xl border border-[#D7E2EF] bg-white p-4 shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B3872F]">Customize</p><h3 className="mt-1 text-base font-semibold text-[#0B2748]">Card preferences</h3></div>
        <VoiceGiftCardInput preferences={props.preferences} onPreferences={props.onPreferences} />

        <div className="relative grid min-w-0 gap-1 text-xs font-semibold text-[#5B6B7A]">Match a cart product
          <button type="button" aria-haspopup="listbox" aria-expanded={productMenuOpen} onClick={() => setProductMenuOpen((open) => !open)} className="flex h-12 min-w-0 items-center gap-2 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-2 text-left text-sm font-medium text-[#16202B] outline-none focus:border-[#3D74B8]">
            {selectedProduct ? <><span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-white"><Image src={selectedProduct.imageUrl} alt="" fill unoptimized sizes="32px" className="object-cover" /></span><span className="min-w-0 flex-1 truncate">{selectedProduct.name}</span></> : <span className="min-w-0 flex-1 truncate text-[#7D8994]">Select a product</span>}
            <span className="text-[10px] text-[#7D8994]">{productMenuOpen ? "▲" : "▼"}</span>
          </button>
          {productMenuOpen ? <div role="listbox" aria-label="Cart products" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-[12px] border border-[#D7E2EF] bg-white p-1.5 shadow-[0_16px_36px_-16px_rgba(10,31,58,.45)]">{props.products.length > 0 ? props.products.map((product) => <button key={product.id} type="button" role="option" aria-selected={product.id === props.selectedProductId} onClick={() => { props.onProduct(product.id); setProductMenuOpen(false); }} className={`flex w-full min-w-0 items-center gap-2 rounded-[9px] p-2 text-left transition ${product.id === props.selectedProductId ? "bg-[#E7EEF7]" : "hover:bg-[#FAF7F1]"}`}><span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[#F5F8FC]"><Image src={product.imageUrl} alt="" fill unoptimized sizes="40px" className="object-cover" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-[#0B2748]">{product.name}</span><span className="mt-0.5 block truncate text-[10px] font-normal text-[#7D8994]">{product.category}</span></span></button>) : <p className="px-3 py-4 text-center text-xs font-normal text-[#7D8994]">No cart products yet.</p>}</div> : null}
        </div>
        {selectedProduct ? <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 rounded-[10px] border border-[#E4E1D8] bg-[#FAF7F1] p-2"><div className="relative h-[52px] overflow-hidden rounded-lg bg-white"><Image src={selectedProduct.imageUrl} alt="" fill unoptimized sizes="52px" className="object-cover" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#0B2748]">{selectedProduct.name}</p><p className="mt-1 text-[11px] text-[#5B6B7A]">Image colors and visual context will guide the card.</p></div></div> : props.products.length === 0 ? <p className="rounded-[10px] bg-[#FFF8E7] px-3 py-2 text-xs leading-5 text-[#8A6823]">Your cart is empty. Add a product in Shopping first, then return here.</p> : null}

        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#5B6B7A]">Language<select value={props.preferences.language} onChange={(event) => update("language", event.target.value as GenieLanguage)} className={fieldClass}>{props.languageOptions.map((language) => <option key={language} value={language}>{props.languageLabels[language]}</option>)}</select></label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#5B6B7A]">Style<select value={props.preferences.style} onChange={(event) => update("style", event.target.value)} className={fieldClass}><option>Elegant</option><option>Playful</option><option>Romantic</option><option>Minimal</option><option>Festive</option></select></label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#5B6B7A]">Theme<select value={props.preferences.theme} onChange={(event) => update("theme", event.target.value)} className={fieldClass}><option>Auto-match product</option><option>Celebration</option><option>Floral</option><option>Modern</option><option>Romantic</option></select></label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#5B6B7A]">Occasion<input value={props.preferences.occasion} onChange={(event) => update("occasion", event.target.value)} maxLength={100} placeholder="Birthday" className={fieldClass} /></label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">Recipient type<input value={props.preferences.recipient} onChange={(event) => update("recipient", event.target.value)} placeholder="Friend, partner, parent…" className={fieldClass} /></label>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#5B6B7A]">Receiver name<input value={props.preferences.receiverName ?? ""} onChange={(event) => update("receiverName", event.target.value)} maxLength={60} placeholder="Optional" className={fieldClass} /></label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-[#5B6B7A]">Sender name<input value={props.preferences.senderName ?? ""} onChange={(event) => update("senderName", event.target.value)} maxLength={60} placeholder="Optional" className={fieldClass} /></label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">Card instructions<textarea value={props.preferences.instructions} onChange={(event) => update("instructions", event.target.value)} rows={3} maxLength={500} placeholder="Mention their name, choose a warm mood, add a short wish…" className="resize-none rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 py-2 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]" /></label>
        <button type="submit" disabled={props.generating || !selectedProduct} className="h-11 rounded-[10px] bg-[#0B2748] px-5 text-sm font-semibold text-white transition hover:bg-[#123661] disabled:cursor-not-allowed disabled:opacity-50">{props.generating ? "Generating card…" : "Generate gift card"}</button>
      </form>
    </div>
  );
}

function VoiceGiftCardInput({ onPreferences, preferences }: Pick<Props, "onPreferences" | "preferences">) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [message, setMessage] = useState("");
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);

  function apply(extraction: Record<string, unknown>) {
    const fields = ["instructions", "language", "occasion", "receiverName", "recipient", "senderName", "style", "theme"] as const;
    const updates = Object.fromEntries(fields.flatMap((field) => {
      const value = extraction[field];
      return typeof value === "string" && value.trim() ? [[field, value.trim()]] : [];
    }));
    const count = Object.keys(updates).length;
    if (count) onPreferences({ ...preferences, ...updates } as GiftCardPreferences);
    setMessage(count ? `Filled ${count} card preference${count === 1 ? "" : "s"}. Review them before generating.` : "No card details were recognized. Please try again.");
  }

  async function analyze(file: File) {
    setState("processing");
    setMessage("Transcribing your card details…");
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("language", "en");
      const transcriptionResponse = await fetch("/api/ai/voice-messages", { method: "POST", body: form });
      const transcription = await transcriptionResponse.json().catch(() => null) as { error?: string; transcript?: string } | null;
      if (!transcriptionResponse.ok || !transcription?.transcript) throw new Error(transcription?.error ?? "Voice transcription failed.");
      setMessage("Filling card preferences…");
      const detailsResponse = await fetch("/api/ai/gift-card-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: transcription.transcript }) });
      const data = await detailsResponse.json().catch(() => null) as { error?: string; extraction?: Record<string, unknown> } | null;
      if (!detailsResponse.ok || !data?.extraction) throw new Error(data?.error ?? "Gift-card detail analysis failed.");
      apply(data.extraction);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Voice card input failed.");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage("Audio recording is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(stream);
      chunks.current = [];
      recorder.current = nextRecorder;
      nextRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      nextRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;
        const type = nextRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        chunks.current = [];
        if (blob.size) void analyze(new File([blob], "gift-card-details.webm", { type }));
        else { setState("idle"); setMessage("No audio was recorded. Please try again."); }
      };
      nextRecorder.start();
      setState("recording");
      setMessage("Recording… say the recipient, occasion, style, theme, names, or card message.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Microphone access was not available.");
    }
  }

  return <div className="rounded-[12px] border border-[#D8E6F6] bg-[#F5F9FE] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-[#0A1F3A]">Fill card details by voice</p><p className="mt-0.5 text-xs text-[#5B6B7A]">English voice input only. You can review every field before generating.</p></div><button type="button" onClick={state === "recording" ? () => recorder.current?.stop() : start} disabled={state === "processing"} className={`inline-flex h-10 items-center gap-2 rounded-[9px] px-3 text-xs font-bold disabled:opacity-55 ${state === "recording" ? "bg-[#B25A2E] text-white" : "bg-[#0A1F3A] text-white"}`}><V3Icon name="mic" className="h-4 w-4" />{state === "recording" ? "Stop & fill" : state === "processing" ? "Processing…" : "Use voice"}</button></div>{message ? <p aria-live="polite" className="mt-2 text-xs leading-5 text-[#35516E]">{message}</p> : null}</div>;
}
