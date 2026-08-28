import { V3Icon } from "./Icon";
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
  clearLabel: string;
};

export function AppHeader(props: Props) {
  return (
    <header className="z-40 flex h-16 min-w-0 items-center justify-between border-b border-[#E4E1D8] bg-white px-4 sm:px-5">
      <p className="genie-wordmark shrink-0 leading-none text-[#0A1F3A]">Genie<span className="text-[#B3872F]">AI</span></p>
      <div className="flex items-center gap-2">
        {props.compareCount > 0 ? (
          <button type="button" disabled={props.compareCount !== 2 || props.isComparing} onClick={props.onCompareDone} className="rounded-full bg-[#C89B3C] px-3 py-2 text-xs font-bold text-[#0A1F3A] disabled:cursor-not-allowed disabled:bg-[#E4E1D8] disabled:text-[#9AA7B2] sm:text-sm">
            {props.isComparing ? "Comparing…" : `Done (${props.compareCount}/2)`}
          </button>
        ) : null}
        <span className="hidden items-center gap-1.5 rounded-full bg-[#E4F3EA] px-3 py-1.5 text-xs font-semibold text-[#2F8F5B] md:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-[#2F8F5B]" />Genie is online</span>
        <label className="flex items-center gap-1 rounded-full border border-[#E4E1D8] bg-white px-2 text-[#3E4A56]">
          <V3Icon name="globe" className="h-4 w-4" />
          <select aria-label="Language" value={props.language} onChange={(event) => props.onLanguageChange(event.target.value as GenieLanguage)} className="h-9 max-w-[82px] bg-transparent text-xs font-semibold outline-none sm:max-w-none sm:text-sm">
            {props.languageOptions.map((language) => <option key={language} value={language}>{props.languageLabels[language]}</option>)}
          </select>
        </label>
        <button type="button" onClick={props.onClearHistory} className="hidden h-9 w-9 place-items-center rounded-full border border-[#E4E1D8] text-[#5B6B7A] hover:bg-[#E7EEF7] hover:text-[#1E4D8C] sm:grid" title={props.clearLabel} aria-label={props.clearLabel}><V3Icon name="trash" className="h-4 w-4" /></button>
        <button type="button" onClick={props.onOpenCart} className="flex h-9 items-center gap-1.5 rounded-full bg-[#0A1F3A] px-3 text-xs font-semibold text-white sm:text-sm" aria-label="Open cart">
          <V3Icon name="cart" className="h-4 w-4" /><span className="hidden sm:inline">Cart</span><span className="rounded-full bg-[#C89B3C] px-1.5 py-0.5 text-[10px] font-bold text-[#0A1F3A]">{props.cartCount}</span>
        </button>
      </div>
    </header>
  );
}
