import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { V3Icon } from "./Icon";
import type { GenieProfile } from "./types";

export type CheckoutDetails = {
  address: string;
  locationType: string;
  recipientName: string;
  recipientPhone: string;
  senderName: string;
};

type Props = {
  checkoutDetails: CheckoutDetails;
  checkoutUrl: string;
  cities: readonly string[];
  creating: boolean;
  dateLabel: string;
  giftMessage: string;
  giftMessageLabel: string;
  locationTypes: readonly string[];
  minimumDeliveryDate: string;
  onClose: () => void;
  onGiftMessage: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  openCheckoutLabel: string;
  profile: GenieProfile;
  setCheckoutDetails: Dispatch<SetStateAction<CheckoutDetails>>;
  setProfile: Dispatch<SetStateAction<GenieProfile>>;
  submitLabel: string;
  warning: string;
};

const fieldClass = "h-11 rounded-[10px] border border-[#E4E1D8] bg-white px-3 text-sm text-[#16202B] outline-none focus:border-[#3D74B8]";

export function CheckoutDialog(props: Props) {
  if (!props.open) return null;
  const updateDetails = (key: keyof CheckoutDetails, value: string) => props.setCheckoutDetails((current) => ({ ...current, [key]: value }));
  const updateProfile = (key: keyof GenieProfile, value: string) => props.setProfile((current) => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0A1F3A]/45 p-4 backdrop-blur-sm"><button type="button" onClick={props.onClose} className="absolute inset-0" aria-label="Close checkout details"/><section role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="relative z-10 max-h-full w-full max-w-2xl overflow-y-auto rounded-[18px] border border-[#E4E1D8] bg-white shadow-[0_16px_40px_-16px_rgba(10,31,58,.4)]"><header className="flex items-start justify-between border-b border-[#E4E1D8] p-5"><div><h2 id="checkout-title" className="font-serif text-xl font-semibold text-[#0A1F3A]">Checkout details</h2><p className="mt-1 text-xs leading-5 text-[#5B6B7A]">Confirm delivery and recipient details before completing your order.</p></div><button type="button" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4E1D8]" aria-label="Close checkout"><V3Icon name="x" className="h-4 w-4" /></button></header>
    {props.checkoutUrl ? <div className="grid gap-4 p-5 text-center"><div className="rounded-[16px] bg-[#FAF7F1] p-5"><p className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#B3872F]">Checkout link ready</p><p className="mt-2 text-sm text-[#5B6B7A]">Open the GenieAI checkout page to complete payment.</p></div><a href={props.checkoutUrl} target="_blank" rel="noreferrer" className="grid h-12 place-items-center rounded-[11px] bg-[linear-gradient(#C89B3C,#B3872F)] text-sm font-bold text-[#0A1F3A]">{props.openCheckoutLabel}</a></div> : <form onSubmit={props.onSubmit} className="grid gap-4 p-5"><VoiceCheckoutInput cities={props.cities} locationTypes={props.locationTypes} minimumDeliveryDate={props.minimumDeliveryDate} setCheckoutDetails={props.setCheckoutDetails} setProfile={props.setProfile}/><div className="grid gap-3 sm:grid-cols-2"><Field label="Recipient name"><input required value={props.checkoutDetails.recipientName} onChange={(event) => updateDetails("recipientName",event.target.value)} className={fieldClass}/></Field><Field label="Recipient phone"><input required type="tel" minLength={7} value={props.checkoutDetails.recipientPhone} onChange={(event) => updateDetails("recipientPhone",event.target.value)} className={fieldClass}/></Field><Field label="Delivery address" wide><input required value={props.checkoutDetails.address} onChange={(event) => updateDetails("address",event.target.value)} className={fieldClass}/></Field><Field label="Delivery city"><select required value={props.profile.city} onChange={(event) => updateProfile("city",event.target.value)} className={fieldClass}><option value="">Select city</option>{props.cities.map((city) => <option key={city}>{city}</option>)}</select></Field><Field label="Location type"><select value={props.checkoutDetails.locationType} onChange={(event) => updateDetails("locationType",event.target.value)} className={fieldClass}><option value="">Optional</option>{props.locationTypes.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label={props.dateLabel}><input required type="date" min={props.minimumDeliveryDate} value={props.profile.date} onChange={(event) => updateProfile("date",event.target.value)} className={fieldClass}/></Field><Field label="Sender name"><input required value={props.checkoutDetails.senderName} onChange={(event) => updateDetails("senderName",event.target.value)} className={fieldClass}/></Field></div><Field label={props.giftMessageLabel}><textarea rows={3} value={props.giftMessage} onChange={(event) => props.onGiftMessage(event.target.value)} className="resize-none rounded-[10px] border border-[#E4E1D8] p-3 text-sm outline-none focus:border-[#3D74B8]"/></Field><button type="submit" disabled={props.creating} className="h-12 rounded-[11px] bg-[linear-gradient(#C89B3C,#B3872F)] text-sm font-bold text-[#0A1F3A] disabled:opacity-55">{props.creating ? "Processing…" : props.submitLabel}</button>{props.warning ? <p className="rounded-lg bg-[#F7E9DF] px-3 py-2 text-xs font-semibold text-[#B25A2E]">{props.warning}</p> : null}</form>}
  </section></div>;
}

function VoiceCheckoutInput({ cities, locationTypes, minimumDeliveryDate, setCheckoutDetails, setProfile }: { cities: readonly string[]; locationTypes: readonly string[]; minimumDeliveryDate: string; setCheckoutDetails: Dispatch<SetStateAction<CheckoutDetails>>; setProfile: Dispatch<SetStateAction<GenieProfile>> }) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [message, setMessage] = useState("");
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);

  function apply(extraction: Record<string, unknown>) {
    const details = ["recipientName", "recipientPhone", "address", "locationType", "senderName"] as const;
    const validDetails = details.filter((key) => typeof extraction[key] === "string" && extraction[key].trim());
    if (validDetails.length) setCheckoutDetails((current) => ({ ...current, ...Object.fromEntries(validDetails.map((key) => [key, typeof extraction[key] === "string" ? extraction[key].trim() : ""])) }));
    const city = typeof extraction.city === "string" ? extraction.city.trim() : "";
    const deliveryDate = typeof extraction.deliveryDate === "string" ? extraction.deliveryDate.trim() : "";
    if (city) setProfile((current) => ({ ...current, city }));
    if (deliveryDate) setProfile((current) => ({ ...current, date: deliveryDate }));
    const count = validDetails.length + Number(Boolean(city)) + Number(Boolean(deliveryDate));
    setMessage(count ? `Filled ${count} checkout detail${count === 1 ? "" : "s"}. Review before completing your order.` : "No usable checkout details were recognized. Please try again.");
  }

  async function analyze(file: File) {
    setState("processing"); setMessage("Transcribing your checkout details…");
    try {
      const form = new FormData(); form.append("audio", file); form.append("language", "en");
      const transcriptionResponse = await fetch("/api/ai/voice-messages", { method: "POST", body: form });
      const transcription = await transcriptionResponse.json().catch(() => null) as { error?: string; transcript?: string } | null;
      if (!transcriptionResponse.ok || !transcription?.transcript) throw new Error(transcription?.error ?? "Voice transcription failed.");
      setMessage("Analyzing checkout details…");
      const extractionResponse = await fetch("/api/ai/checkout-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cities, locationTypes, minimumDeliveryDate, transcript: transcription.transcript }) });
      const data = await extractionResponse.json().catch(() => null) as { error?: string; extraction?: Record<string, unknown> } | null;
      if (!extractionResponse.ok || !data?.extraction) throw new Error(data?.error ?? "Checkout detail analysis failed.");
      apply(data.extraction);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Voice checkout input failed."); }
    finally { setState("idle"); }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setMessage("Audio recording is not available in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const nextRecorder = new MediaRecorder(stream); chunks.current = []; recorder.current = nextRecorder;
      nextRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      nextRecorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); recorder.current = null; const type = nextRecorder.mimeType || "audio/webm"; const blob = new Blob(chunks.current, { type }); chunks.current = []; if (blob.size) void analyze(new File([blob], "checkout-details.webm", { type })); else { setState("idle"); setMessage("No audio was recorded. Please try again."); } };
      nextRecorder.start(); setState("recording"); setMessage("Recording… say recipient and sender names, phone, address, city, location type, and delivery date. Gift messages are not changed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Microphone access was not available."); }
  }

  return <div className="rounded-[12px] border border-[#D8E6F6] bg-[#F5F9FE] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-[#0A1F3A]">Fill delivery details by voice</p><p className="mt-0.5 text-xs text-[#5B6B7A]">English voice input only. Your gift message will not be changed.</p></div><button type="button" onClick={state === "recording" ? () => recorder.current?.stop() : start} disabled={state === "processing"} className={`inline-flex h-10 items-center gap-2 rounded-[9px] px-3 text-xs font-bold disabled:opacity-55 ${state === "recording" ? "bg-[#B25A2E] text-white" : "bg-[#0A1F3A] text-white"}`}><V3Icon name="mic" className="h-4 w-4" />{state === "recording" ? "Stop & fill" : state === "processing" ? "Processing…" : "Use voice"}</button></div>{message ? <p aria-live="polite" className="mt-2 text-xs leading-5 text-[#35516E]">{message}</p> : null}</div>;
}

function Field({ children, label, wide = false }: { children: React.ReactNode; label: string; wide?: boolean }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#5B6B7A] ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}
