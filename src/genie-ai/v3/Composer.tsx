import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";
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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVoice: () => void;
  placeholder: string;
  sendLabel: string;
  value: string;
};

export function Composer({ children, disabled, formRef, imageInputRef, inputRef, isRecording, onImage, onInput, onFocus, onSubmit, onVoice, placeholder, sendLabel, value }: Props) {
  return <div ref={formRef} className="genie-composer relative shrink-0 bg-[linear-gradient(transparent,#FAF7F1_28%)] px-4 pb-4 pt-3 sm:px-7">
    {children}
    <form onSubmit={onSubmit} className="flex items-center gap-1.5 rounded-2xl border border-[#E4E1D8] bg-white p-2 shadow-[0_8px_24px_-12px_rgba(10,31,58,.18)]">
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button type="button" onClick={onVoice} disabled={disabled} className={`grid h-9 w-8 place-items-center rounded-[10px] transition sm:w-9 ${isRecording ? "bg-[#F7E9DF] text-[#B25A2E]" : "text-[#5B6B7A] hover:bg-[#E7EEF7] hover:text-[#1E4D8C]"}`} aria-label="Voice input"><V3Icon name="mic" className="h-[18px] w-[18px]" /></button>
        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={disabled} className="grid h-9 w-8 place-items-center rounded-[10px] text-[#5B6B7A] transition hover:bg-[#E7EEF7] hover:text-[#1E4D8C] sm:w-9" aria-label="Upload a photo"><V3Icon name="camera" className="h-[18px] w-[18px]" /></button>
      </div>
      <input ref={imageInputRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
      <input ref={inputRef} value={value} onChange={(event) => onInput(event.target.value)} onFocus={onFocus} disabled={disabled} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-[#16202B] outline-none placeholder:text-[#9AA7B2]" />
      <button type="submit" disabled={disabled || !value.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[#0A1F3A] text-white disabled:cursor-not-allowed disabled:opacity-45" title={sendLabel} aria-label={sendLabel}><V3Icon name="send" className="h-[18px] w-[18px]" /></button>
    </form>
  </div>;
}
