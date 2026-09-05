type Props = {
  chips: string[];
  getLabel: (chip: string) => string;
  onSelect: (chip: string) => void;
  underMessage?: boolean;
};

export function ReplyChips({ chips, getLabel, onSelect, underMessage = false }: Props) {
  if (chips.length === 0) return null;
  return (
    <div className={underMessage ? "mt-2 flex w-full flex-wrap gap-x-2 gap-y-1.5 md:gap-2" : "mt-2 flex flex-wrap gap-x-2 gap-y-1.5 md:ml-[54px] md:mt-4 md:gap-2"}>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          className="rounded-full border border-[#E4E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#1E4D8C] transition hover:border-[#3D74B8] hover:bg-[#E7EEF7]"
        >
          {getLabel(chip)}
        </button>
      ))}
    </div>
  );
}
