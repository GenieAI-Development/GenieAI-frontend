"use client";

import { useEffect, useRef, useState } from "react";
import { GenieMark, V3Icon } from "./Icon";
import type { GenieLanguage } from "./types";

type Props = {
  cartCount: number;
  compareCount: number;
  isComparing: boolean;
  language: GenieLanguage;
  languageLabels: Record<GenieLanguage, string>;
  languageOptions: GenieLanguage[];
  onCompareDone: () => void;
  onClearHistory: () => void;
  onLanguageChange: (language: GenieLanguage) => void;
  onOpenCart: () => void;
  onOpenPreferences: () => void;
  clearLabel: string;
};

export function AppHeader(props: Props) {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isLanguageMenuOpen]);

  return (
    <header className="z-40 grid h-16 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[#E4E1D8] bg-white px-3 sm:flex sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-2"><GenieMark className="h-8 w-8 shrink-0 rounded-[9px]" /><p className="genie-wordmark min-w-0 truncate leading-none text-[#0A1F3A] sm:max-w-none">Genie<span className="text-[#B3872F]">AI</span></p></div>
      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
        {props.compareCount > 0 ? (
          <button type="button" disabled={props.compareCount !== 2 || props.isComparing} onClick={props.onCompareDone} className="h-9 shrink-0 rounded-full bg-[#C89B3C] px-2.5 text-[11px] font-bold text-[#0A1F3A] disabled:cursor-not-allowed disabled:bg-[#E4E1D8] disabled:text-[#9AA7B2] sm:px-3 sm:text-sm">
            {props.isComparing ? "Wait…" : <>Done <span className="sm:hidden">{props.compareCount}/2</span><span className="hidden sm:inline">({props.compareCount}/2)</span></>}
          </button>
        ) : null}
        <span className="hidden items-center gap-1.5 rounded-full bg-[#E4F3EA] px-3 py-1.5 text-xs font-semibold text-[#2F8F5B] md:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-[#2F8F5B]" />Genie is online</span>
        <div ref={languageMenuRef} className="relative shrink-0">
          <button type="button" aria-label="Choose language" aria-haspopup="menu" aria-expanded={isLanguageMenuOpen} onClick={() => setIsLanguageMenuOpen((open) => !open)} className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white text-[#31577F] shadow-sm transition sm:w-auto sm:min-w-[108px] sm:justify-between sm:gap-2 sm:rounded-[10px] sm:px-3 ${isLanguageMenuOpen ? "border-[#3D74B8] ring-2 ring-[#D7E2EF]" : "border-[#E4E1D8] hover:border-[#9EB7D2] hover:bg-[#F5F8FC]"}`}>
            <span className="flex min-w-0 items-center gap-2"><V3Icon name="globe" className="h-4 w-4 shrink-0" /><span className="hidden truncate text-xs font-semibold sm:inline">{props.languageLabels[props.language]}</span></span>
          </button>
          {isLanguageMenuOpen ? (
            <div role="menu" aria-label="Languages" className="absolute right-0 top-[calc(100%+8px)] z-[70] grid min-w-[156px] gap-1 rounded-[14px] border border-[#D7E2EF] bg-white p-1.5 shadow-[0_16px_40px_-18px_rgba(10,31,58,.45)]">
              {props.languageOptions.map((language) => {
                const active = language === props.language;
                return <button key={language} type="button" role="menuitemradio" aria-checked={active} onClick={() => { props.onLanguageChange(language); setIsLanguageMenuOpen(false); }} className={`flex h-9 items-center justify-between rounded-[9px] px-3 text-left text-xs font-semibold transition ${active ? "bg-[#E7EEF7] text-[#123661]" : "text-[#5B6B7A] hover:bg-[#FAF7F1] hover:text-[#0B2748]"}`}><span>{props.languageLabels[language]}</span><span className={`h-2 w-2 rounded-full ${active ? "bg-[#C89B3C]" : "bg-transparent"}`} /></button>;
              })}
            </div>
          ) : null}
        </div>
        <button type="button" onClick={props.onClearHistory} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#E4E1D8] text-[#5B6B7A] hover:bg-[#E7EEF7] hover:text-[#1E4D8C]" title={props.clearLabel} aria-label={props.clearLabel}><V3Icon name="trash" className="h-4 w-4" /></button>
        <button type="button" onClick={props.onOpenPreferences} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E4E1D8] text-[#31577F] transition hover:border-[#9EB7D2] hover:bg-[#F5F8FC] sm:w-auto sm:gap-1.5 sm:rounded-[10px] sm:px-3" aria-label="Open preferences">
          <V3Icon name="settings" className="h-4 w-4" /><span className="hidden text-xs font-semibold sm:inline">Preferences</span>
        </button>
        <button type="button" onClick={props.onOpenCart} className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0A1F3A] text-xs font-semibold text-white sm:flex sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm" aria-label="Open cart">
          <V3Icon name="cart" className="h-4 w-4" /><span className="hidden sm:inline">Cart</span><span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#C89B3C] px-1 py-0.5 text-center text-[9px] font-bold leading-3 text-[#0A1F3A] sm:static sm:min-w-0 sm:px-1.5 sm:text-[10px]">{props.cartCount}</span>
        </button>
      </div>
    </header>
  );
}
