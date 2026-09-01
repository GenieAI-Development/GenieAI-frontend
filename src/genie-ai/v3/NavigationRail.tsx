import { V3Icon } from "./Icon";
import type { GenieMode } from "./types";

const modeIcons: Record<string, string> = {
  "Smart Shopping": "shopping",
  "Event Planner": "calendar",
  "Gift Box Builder": "box",
  "Product Compare": "compare",
  "Gift Message": "gift",
  "Order Tracking": "truck",
};

const shortLabels: Record<string, string> = {
  "Smart Shopping": "Shopping",
  "Event Planner": "Events",
  "Gift Box Builder": "Gift Box",
  "Product Compare": "Compare",
  "Gift Message": "Message",
  "Order Tracking": "Track",
};

export function NavigationRail({ activeMode, modes, onModeChange }: { activeMode: string; modes: GenieMode[]; onModeChange: (mode: string) => void }) {
  const visibleModes = modes.filter((mode) => mode.name !== "Analytics");
  return (
    <nav aria-label="Genie sections" className="fixed inset-x-0 bottom-0 z-50 flex h-[62px] items-center justify-evenly gap-0.5 overflow-hidden border-t border-white/10 bg-[#0B2748] px-1 font-sans md:static md:h-[calc(100dvh-64px)] md:min-h-0 md:w-[84px] md:flex-col md:justify-start md:gap-1 md:overflow-y-auto md:border-t-0 md:px-2 md:py-2">
      {visibleModes.map((mode) => {
        const active = activeMode === mode.name;
        return <button key={mode.name} type="button" onClick={() => onModeChange(mode.name)} className={`genie-nav-item flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-[10px] px-0.5 text-center font-semibold leading-none tracking-normal transition md:h-[60px] md:w-[68px] md:flex-none md:gap-1.5 md:rounded-[15px] md:px-1 ${active ? "bg-[#D6A936] text-[#071A30]" : "text-[#AFC8E5] hover:bg-white/5 hover:text-white"}`}><V3Icon name={modeIcons[mode.name] ?? mode.icon} className="h-[18px] w-[18px] shrink-0" /><span className="max-w-full whitespace-normal">{shortLabels[mode.name] ?? mode.name}</span></button>;
      })}
    </nav>
  );
}
