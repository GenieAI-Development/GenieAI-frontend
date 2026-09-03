"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Product } from "@/lib/productCatalog";
import { GiftCardTool, type GiftCardPreferences } from "../v3/GiftCardTool";
import type { GenieLanguage } from "../v3/types";

export type GiftMessagePreferences = {
  language: GenieLanguage;
  size: string;
  suggestions: string;
  tone: string;
};
type Tab = "card" | "message";

type Props = {
  card: {
    analysis: string;
    generatedImage: string;
    generating: boolean;
    message: string;
    palette: string[];
    preferences: GiftCardPreferences;
    selectedProductId: string;
  };
  languageLabels: Record<GenieLanguage, string>;
  languageOptions: GenieLanguage[];
  message: string;
  messageGenerating: boolean;
  messagePreferences: GiftMessagePreferences;
  products: Product[];
  tab: Tab;
  onCardPreferences: Dispatch<SetStateAction<GiftCardPreferences>>;
  onCardProduct: (productId: string) => void;
  onCardSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMessage: (message: string) => void;
  onMessagePreferences: Dispatch<SetStateAction<GiftMessagePreferences>>;
  onMessageSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTab: (tab: Tab) => void;
};

function Tabs({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <div className="w-full overflow-x-auto pb-px">
      <div
        className="relative grid h-11 min-w-[300px] grid-cols-2 border-b-2 border-[#DCE2E8] bg-transparent"
        role="tablist"
        aria-label="Gift creation tools"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -bottom-0.5 left-0 h-0.5 w-1/2 bg-[#D6A936] transition-transform duration-300 ease-out ${tab === "card" ? "translate-x-full" : "translate-x-0"}`}
        />
        <button
          type="button"
          role="tab"
          aria-selected={tab === "message"}
          onClick={() => onTab("message")}
          className={`relative min-w-0 text-sm font-medium transition-colors duration-200 ${tab === "message" ? "text-[#16202B]" : "text-[#6C7C8C] hover:text-[#31577F]"}`}
        >
          Message
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "card"}
          onClick={() => onTab("card")}
          className={`relative min-w-0 text-sm font-medium transition-colors duration-200 ${tab === "card" ? "text-[#16202B]" : "text-[#6C7C8C] hover:text-[#31577F]"}`}
        >
          Gift Card
        </button>
      </div>
    </div>
  );
}

export function GiftCreationTool(props: Props) {
  if (props.tab === "card")
    return (
      <div className="flex min-h-0 flex-col gap-3 lg:h-full">
        <Tabs tab={props.tab} onTab={props.onTab} />
        <div className="min-h-0 flex-1">
          <GiftCardTool
            analysis={props.card.analysis}
            generatedImage={props.card.generatedImage}
            generating={props.card.generating}
            languageLabels={props.languageLabels}
            languageOptions={props.languageOptions}
            message={props.card.message}
            onPreferences={props.onCardPreferences}
            onProduct={props.onCardProduct}
            onSubmit={props.onCardSubmit}
            palette={props.card.palette}
            preferences={props.card.preferences}
            products={props.products}
            selectedProductId={props.card.selectedProductId}
          />
        </div>
      </div>
    );

  const update = <Key extends keyof GiftMessagePreferences>(
    key: Key,
    value: GiftMessagePreferences[Key],
  ) => props.onMessagePreferences((current) => ({ ...current, [key]: value }));
  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full">
      <Tabs tab={props.tab} onTab={props.onTab} />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <section className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-[#D7E2EF] bg-white shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]">
          <div className="bg-[#0B2748] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#D6A936]">
              Personal note
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Gift Message
            </h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-[#FAF7F1] p-4">
            <label
              className="mb-2 text-xs font-semibold text-[#5B6B7A]"
              htmlFor="gift-message-editor"
            >
              Your message
            </label>
            <textarea
              id="gift-message-editor"
              value={props.message}
              onChange={(event) => props.onMessage(event.target.value)}
              className="min-h-[210px] w-full flex-1 resize-none rounded-xl border border-[#D7E2EF] bg-white p-4 text-base leading-7 text-[#16202B] outline-none transition focus:border-[#3D74B8]"
              placeholder="Your generated gift message will appear here…"
            />
          </div>
        </section>
        <form
          onSubmit={props.onMessageSubmit}
          className="grid content-start gap-3 rounded-2xl border border-[#D7E2EF] bg-white p-4 shadow-[0_12px_32px_-24px_rgba(10,31,58,.35)]"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B3872F]">
              Customize
            </p>
            <h3 className="mt-1 text-base font-semibold text-[#0B2748]">
              Message preferences
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
              Language
              <select
                value={props.messagePreferences.language}
                onChange={(event) =>
                  update("language", event.target.value as GenieLanguage)
                }
                className="h-10 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              >
                {props.languageOptions.map((option) => (
                  <option key={option} value={option}>
                    {props.languageLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
              Size
              <select
                value={props.messagePreferences.size}
                onChange={(event) => update("size", event.target.value)}
                className="h-10 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              >
                <option>Short</option>
                <option>Medium</option>
                <option>Long</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
              Tone
              <select
                value={props.messagePreferences.tone}
                onChange={(event) => update("tone", event.target.value)}
                className="h-10 rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              >
                <option>Warm</option>
                <option>Romantic</option>
                <option>Respectful</option>
                <option>Funny</option>
                <option>Formal</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[#5B6B7A]">
            Suggestions
            <textarea
              value={props.messagePreferences.suggestions}
              onChange={(event) => update("suggestions", event.target.value)}
              rows={3}
              className="resize-none rounded-[10px] border border-[#D7E2EF] bg-[#FAF7F1] px-3 py-2 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]"
              placeholder="Example: make it romantic, mention birthday, keep it simple..."
            />
          </label>
          <button
            type="submit"
            disabled={props.messageGenerating}
            className="h-10 rounded-[10px] bg-[#0B2748] px-5 text-sm font-semibold text-white transition hover:bg-[#123661] disabled:opacity-50"
          >
            {props.messageGenerating ? "Updating..." : "Update message"}
          </button>
        </form>
      </div>
    </div>
  );
}
