import type { ReactNode } from "react";
import { V3Icon } from "./Icon";

type Props = {
  children: ReactNode;
  icon: string;
  open: boolean;
  title: string;
  onClose: () => void;
};

export function Drawer({ children, icon, open, title, onClose }: Props) {
  return <>
    <button type="button" aria-label={`Close ${title}`} onClick={onClose} tabIndex={open ? 0 : -1} className={`fixed inset-0 z-[70] bg-[#0A1F3A]/40 backdrop-blur-[1px] transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
    <aside role="dialog" aria-modal="true" aria-hidden={!open} aria-label={title} className={`fixed bottom-0 right-0 top-0 z-[80] flex w-full max-w-[400px] flex-col bg-white shadow-[-16px_0_40px_rgba(10,31,58,.22)] transition-transform duration-300 ease-out ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
      <header className="flex items-center justify-between border-b border-[#E4E1D8] px-5 py-4"><h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-[#0A1F3A]"><V3Icon name={icon} className="h-[18px] w-[18px] text-[#1E4D8C]" />{title}</h2><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#E4E1D8] text-[#3E4A56]" aria-label={`Close ${title}`}><V3Icon name="x" className="h-4 w-4" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </aside>
  </>;
}
