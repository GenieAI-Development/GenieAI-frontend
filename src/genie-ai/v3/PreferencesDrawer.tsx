import type { Dispatch, SetStateAction } from "react";
import { Drawer } from "./Drawer";
import type { GenieProfile } from "./types";
import type { SearchMode } from "../types";

type Props = {
  budgetError: string;
  budgetMax: string;
  budgetMin: string;
  budgetOptions: readonly string[];
  cities: readonly string[];
  giftTypes: readonly string[];
  isSending: boolean;
  occasions: readonly string[];
  onApply: () => void;
  onBudgetMax: (value: string) => void;
  onBudgetMin: (value: string) => void;
  onClose: () => void;
  open: boolean;
  profile: GenieProfile;
  recipients: readonly string[];
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  setProfile: Dispatch<SetStateAction<GenieProfile>>;
};

const inputClass = "h-10 w-full rounded-lg border border-[#E4E1D8] bg-white px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]";

export function PreferencesDrawer(props: Props) {
  const update = (key: keyof GenieProfile, value: string) => props.setProfile((current) => ({ ...current, [key]: value }));
  return <Drawer open={props.open} onClose={props.onClose} icon="settings" title="Preferences"><div className="space-y-4">
    <label className="block text-xs font-semibold text-[#5B6B7A]">Budget (Rs.)<div className="mt-1.5 grid grid-cols-2 gap-2"><input type="number" min="0" value={props.budgetMin} onChange={(event) => props.onBudgetMin(event.target.value)} placeholder="Min" className={inputClass}/><input type="number" min="0" value={props.budgetMax} onChange={(event) => props.onBudgetMax(event.target.value)} placeholder="Max" className={inputClass}/></div>{props.budgetError ? <span className="mt-1 block text-[11px] text-[#B25A2E]">{props.budgetError}</span> : null}</label>
    <SelectField label="Preset budget" value={props.profile.budget} options={props.budgetOptions} onChange={(value) => update("budget", value)} />
    <SelectField label="Recipient" value={props.profile.recipient} options={props.recipients} onChange={(value) => update("recipient", value)} />
    <SelectField label="Occasion" value={props.profile.occasion} options={props.occasions} onChange={(value) => update("occasion", value)} />
    <SelectField label="Gift type" value={props.profile.category} options={props.giftTypes} onChange={(value) => update("category", value)} />
    <SelectField label="Delivery city" value={props.profile.city} options={props.cities} onChange={(value) => update("city", value)} />
    <label className="block text-xs font-semibold text-[#5B6B7A]">Search mode<select value={props.searchMode} onChange={(event) => props.setSearchMode(event.target.value as SearchMode)} className={`${inputClass} mt-1.5`}><option value="instant">Instant — faster results</option><option value="thinking">Thinking — deeper relevance match</option></select><span className="mt-1 block text-[11px] font-normal leading-4 text-[#6B7785]">{props.searchMode === "thinking" ? "Uses deeper relevance ranking." : "Uses catalog ranking only for the fastest results."}</span></label>
    <button type="button" disabled={props.isSending} onClick={props.onApply} className="w-full rounded-[11px] bg-[linear-gradient(#C89B3C,#B3872F)] px-4 py-3 text-sm font-bold text-[#0A1F3A] disabled:opacity-50">{props.isSending ? "Applying…" : "Apply preferences"}</button>
  </div></Drawer>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-[#5B6B7A]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-1.5`}><option value="">No preference</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
