import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { SearchMode } from "../types";
import { V3Icon } from "./Icon";

type Props = {
  children?: ReactNode;
  disabled: boolean;
  formRef: RefObject<HTMLDivElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  isRecording: boolean;
  onImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onInput: (value: string) => void;
  onFocus: () => void;
  onDismissSuggestedPrompts: () => void;
  onSuggestedPrompts: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVoice: () => void;
  placeholder: string;
  searchMode: SearchMode;
  sendLabel: string;
  setSearchMode: (mode: SearchMode) => void;
  value: string;
};

export function Composer({ children, disabled, formRef, imageInputRef, inputRef, isRecording, onDismissSuggestedPrompts, onImage, onFocus, onInput, onSuggestedPrompts, onSubmit, onVoice, placeholder, searchMode, sendLabel, setSearchMode, value }: Props) {
  return <div ref={formRef} className="genie-composer relative shrink-0 bg-[linear-gradient(transparent,#FAF7F1_28%)] px-4 pb-4 pt-3 sm:px-7">
    {children}
    <form onSubmit={onSubmit} className="flex items-center gap-1.5 rounded-2xl border border-[#E4E1D8] bg-white p-2 shadow-[0_8px_24px_-12px_rgba(10,31,58,.18)]">
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        <button type="button" onClick={onVoice} disabled={disabled} className={`grid h-9 w-9 place-items-center rounded-[10px] transition ${isRecording ? "bg-[#F7E9DF] text-[#B25A2E]" : "text-[#5B6B7A] hover:bg-[#E7EEF7] hover:text-[#1E4D8C]"}`} aria-label="Voice input"><V3Icon name="mic" className="h-[18px] w-[18px]" /></button>
        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-[10px] text-[#5B6B7A] transition hover:bg-[#E7EEF7] hover:text-[#1E4D8C]" aria-label="Upload a photo"><V3Icon name="camera" className="h-[18px] w-[18px]" /></button>
        <button type="button" onClick={onSuggestedPrompts} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-[10px] text-[#5B6B7A] transition hover:bg-[#E7EEF7] hover:text-[#1E4D8C]" aria-label="Show suggested messages"><V3Icon name="ai" className="h-[18px] w-[18px]" /></button>
      </div>
      <MobileAttachmentMenu disabled={disabled} imageInputRef={imageInputRef} isRecording={isRecording} onSuggestedPrompts={onSuggestedPrompts} onVoice={onVoice} />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
      <input ref={inputRef} value={value} onChange={(event) => onInput(event.target.value)} onClick={onFocus} onFocus={onFocus} disabled={disabled} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-[#16202B] outline-none placeholder:text-[#9AA7B2]" />
      <SearchModeMenu disabled={disabled} onOpen={onDismissSuggestedPrompts} searchMode={searchMode} setSearchMode={setSearchMode} />
      <button type="submit" disabled={disabled || !value.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[#0A1F3A] text-white disabled:cursor-not-allowed disabled:opacity-45" title={sendLabel} aria-label={sendLabel}><V3Icon name="send" className="h-[18px] w-[18px]" /></button>
    </form>
  </div>;
}

function SearchModeMenu({ disabled, onOpen, searchMode, setSearchMode }: Pick<Props, "disabled" | "searchMode" | "setSearchMode"> & { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const modeLabel = searchMode === "thinking" ? "Thinking" : "Instant";
  const helperText = searchMode === "thinking" ? "Deeper relevance ranking" : "Fast catalog ranking";

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return <div ref={menuRef} className="relative shrink-0">
    <button type="button" disabled={disabled} onClick={() => { onOpen(); setOpen((current) => !current); }} aria-expanded={open} aria-haspopup="listbox" className="flex h-9 min-w-[58px] flex-col justify-center rounded-[11px] border border-[#D7E2EF] bg-[#FAF7F1] px-2 text-left leading-tight text-[#0A1F3A] transition hover:border-[#9EB7D2] hover:bg-[#F5F8FC] disabled:opacity-50 sm:h-10 sm:min-w-[94px] sm:rounded-[13px] sm:px-3">
      <span className="flex items-center gap-1 text-[10px] font-semibold sm:text-xs"><span className="sm:hidden">{searchMode === "thinking" ? "Think" : "Now"}</span><span className="hidden sm:inline">{modeLabel}</span><svg aria-hidden="true" viewBox="0 0 12 12" className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m2.5 4.5 3.5 3 3.5-3" /></svg></span>
      <span className="mt-0.5 hidden text-[9px] font-medium text-[#5B6B7A] sm:block">{helperText}</span>
    </button>
    {open ? <div role="listbox" aria-label="Search mode" className="absolute bottom-full right-0 z-30 mb-2 w-56 overflow-hidden rounded-[20px] border border-[#E4E1D8] bg-[#FFFCF7] p-2 shadow-[0_16px_32px_-12px_rgba(10,31,58,.24)]">
      <ModeOption active={searchMode === "instant"} description="Fast catalog ranking" label="Instant" onClick={() => { setSearchMode("instant"); setOpen(false); }} />
      <ModeOption active={searchMode === "thinking"} description="Deeper relevance ranking" label="Thinking" onClick={() => { setSearchMode("thinking"); setOpen(false); }} />
    </div> : null}
  </div>;
}

function MobileAttachmentMenu({ disabled, imageInputRef, isRecording, onSuggestedPrompts, onVoice }: Pick<Props, "disabled" | "imageInputRef" | "isRecording" | "onSuggestedPrompts" | "onVoice">) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return <div ref={menuRef} className="relative flex shrink-0 items-center sm:hidden">
    <button type="button" disabled={disabled} onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label="More message actions" className="grid h-9 w-8 place-items-center rounded-[10px] text-[#0A1F3A] transition hover:bg-[#E7EEF7] hover:text-[#1E4D8C] disabled:opacity-50"><V3Icon name="plus" className={`h-[18px] w-[18px] transition ${open ? "rotate-45" : ""}`} /></button>
    <button type="button" disabled={disabled} onClick={onSuggestedPrompts} className="grid h-9 w-8 place-items-center rounded-[10px] text-[#5B6B7A] transition hover:bg-[#E7EEF7] hover:text-[#1E4D8C] disabled:opacity-50" aria-label="Show suggested messages"><V3Icon name="ai" className="h-[17px] w-[17px]" /></button>
    {open ? <div className="absolute bottom-full left-0 z-30 mb-2 grid w-40 gap-1 rounded-[16px] border border-[#E4E1D8] bg-[#FFFCF7] p-2 shadow-[0_16px_32px_-12px_rgba(10,31,58,.24)]"><button type="button" onClick={() => { imageInputRef.current?.click(); setOpen(false); }} className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-[#16202B] hover:bg-[#F5F8FC]"><V3Icon name="camera" className="h-4 w-4 text-[#31577F]" />Add photo</button><button type="button" onClick={() => { onVoice(); setOpen(false); }} className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-[#16202B] hover:bg-[#F5F8FC]"><V3Icon name="mic" className={`h-4 w-4 ${isRecording ? "text-[#B25A2E]" : "text-[#31577F]"}`} />Voice message</button></div> : null}
  </div>;
}

function ModeOption({ active, description, label, onClick }: { active: boolean; description: string; label: string; onClick: () => void }) {
  return <button type="button" role="option" aria-selected={active} onClick={onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${active ? "bg-[#E7EEF7] text-[#0A1F3A]" : "text-[#16202B] hover:bg-[#F5F8FC]"}`}><span><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-[11px] text-[#5B6B7A]">{description}</span></span>{active ? <span aria-hidden="true" className="text-base text-[#B3872F]">✓</span> : null}</button>;
}
