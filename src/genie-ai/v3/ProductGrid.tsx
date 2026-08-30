import Image from "next/image";
import { cleanProductDescription } from "@/lib/productDescription";
import type { GenieProduct } from "./types";

type Props = {
  addLabel: string;
  cartIds: Set<string>;
  compareIds: string[];
  emptyLabel: string;
  formatPrice: (price: number, currency: string) => string;
  isLoading: boolean;
  onAdd: (product: GenieProduct) => void;
  onCompare: (id: string) => void;
  onView: (product: GenieProduct) => void;
  products: GenieProduct[];
  viewLabel: string;
};

export function ProductGrid(props: Props) {
  if (props.isLoading && props.products.length === 0) {
    return <div className="grid auto-cols-[68%] grid-flow-col gap-2.5 overflow-x-auto pb-1.5 md:grid-flow-row md:grid-cols-4">{[0,1,2,3].map((item) => <div key={item} className="h-[250px] animate-pulse rounded-[14px] border border-[#E4E1D8] bg-white"><div className="h-28 bg-[#E7EEF7] sm:h-32" /><div className="space-y-2 p-3"><div className="h-3.5 w-3/4 rounded bg-[#E4E1D8]"/><div className="h-3 rounded bg-[#F6ECD3]"/><div className="h-8 rounded bg-[#E4E1D8]"/></div></div>)}</div>;
  }
  if (props.products.length === 0) return <div className="rounded-[18px] border border-dashed border-[#E4E1D8] bg-white p-5 text-sm leading-6 text-[#5B6B7A]">{props.emptyLabel}</div>;
  return (
    <section aria-label="Recommended products">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.1px] text-[#B3872F]">Recommended products</p>
      <div className="grid auto-cols-[68%] grid-flow-col gap-2.5 overflow-x-auto pb-1.5 snap-x snap-mandatory md:grid-flow-row md:auto-cols-auto md:grid-cols-4 md:overflow-visible">
        {props.products.map((product) => {
          const selected = props.compareIds.includes(product.id);
          const full = props.compareIds.length >= 2 && !selected;
          const inCart = props.cartIds.has(product.id);
          return <article key={product.id} className="flex snap-start flex-col overflow-hidden rounded-[14px] border border-[#E4E1D8] bg-white shadow-[0_6px_18px_-12px_rgba(10,31,58,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(10,31,58,.25)]">
            <div className="relative h-28 shrink-0 overflow-hidden bg-[linear-gradient(155deg,#E7EEF7,#F1E9D6)] sm:h-32">
              <Image src={product.imageUrl} alt={product.name} fill unoptimized sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 72vw" className="object-cover" />
              <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold ${product.stockLabel.toLowerCase().includes("low") ? "bg-[#F7E9DF] text-[#B25A2E]" : "bg-[#E4F3EA] text-[#2F8F5B]"}`}>{product.stockLabel}</span>
              <button type="button" aria-pressed={selected} disabled={full} onClick={() => props.onCompare(product.id)} className={`absolute right-2 top-2 rounded-md border px-2 py-1 text-[10px] font-bold shadow-sm backdrop-blur disabled:opacity-50 ${selected ? "border-[#C89B3C] bg-[#C89B3C] text-[#0A1F3A]" : "border-white/80 bg-white/90 text-[#1E4D8C]"}`}>{selected ? "Selected" : props.compareIds.length ? "Select" : "Compare"}</button>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2.5">
              <h3 className="line-clamp-1 font-sans text-[13px] font-semibold leading-4 text-[#16202B]">{product.name}</h3>
              <p className="line-clamp-2 flex-1 text-[11px] leading-4 text-[#5B6B7A]">{cleanProductDescription(product.description)}</p>
              <p className="text-sm font-bold leading-5 text-[#123661]">{props.formatPrice(product.price, product.currency)}</p>
              <div className="grid grid-cols-[1fr_auto] gap-1.5">
                <button type="button" disabled={inCart} onClick={() => props.onAdd(product)} className="h-8 rounded-lg bg-[linear-gradient(#C89B3C,#B3872F)] px-2 text-[11px] font-bold text-[#0A1F3A] disabled:opacity-55">{inCart ? "Added" : props.addLabel}</button>
                <button type="button" onClick={() => props.onView(product)} className="h-8 rounded-lg border border-[#E4E1D8] px-2.5 text-[11px] font-semibold text-[#16202B]">{props.viewLabel}</button>
              </div>
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
