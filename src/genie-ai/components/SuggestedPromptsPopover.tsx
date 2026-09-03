import type { SuggestedPrompt } from "../types";

export function SuggestedPromptsPopover({
  prompts,
  onSelect,
}: {
  prompts: SuggestedPrompt[];
  onSelect: (prompt: SuggestedPrompt) => void;
}) {
  return (
    <div className="absolute bottom-[calc(100%+8px)] left-4 right-4 z-40 grid gap-2 rounded-[14px] border border-[#E4E1D8] bg-white p-2 shadow-[0_16px_40px_-16px_rgba(10,31,58,.35)] sm:left-7 sm:right-7">
      {prompts.map((prompt) => (
        <button
          key={prompt.text}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-[10px] bg-[#FAF7F1] px-4 py-3 text-left text-sm text-[#3E4A56] transition hover:bg-[#E7EEF7]"
        >
          {prompt.text}
        </button>
      ))}
    </div>
  );
}
