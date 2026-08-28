import Image from "next/image";
import { Drawer } from "./Drawer";
import { V3Icon } from "./Icon";
import type { GenieProduct } from "./types";

type Props = {
  checkoutLabel: string;
  delivery: number;
  formatPrice: (price: number, currency?: string) => string;
  items: GenieProduct[];
  onCheckout: () => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  open: boolean;
  subtotal: number;
  total: number;
};

export function CartDrawer(props: Props) {
  return <Drawer open={props.open} onClose={props.onClose} icon="cart" title="Your order">
    <div className="flex min-h-full flex-col gap-4">
      {props.items.length === 0 ? <div className="rounded-xl border border-dashed border-[#E4E1D8] px-4 py-6 text-center text-xs leading-6 text-[#5B6B7A]"><V3Icon name="cart" className="mx-auto mb-2 h-7 w-7 text-[#9AA7B2]" />Nothing added yet. Pick a product from the chat and it will land here.</div> : <div className="space-y-3">{props.items.map((item) => <article key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#E4E1D8] p-2.5"><div className="relative h-14 w-14 overflow-hidden rounded-lg bg-[#E7EEF7]"><Image src={item.imageUrl} alt="" fill unoptimized sizes="56px" className="object-cover" /></div><div className="min-w-0"><h3 className="truncate text-xs font-semibold">{item.name}</h3><p className="mt-1 text-xs font-bold text-[#123661]">{props.formatPrice(item.price,item.currency)}</p></div><button type="button" onClick={() => props.onRemove(item.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[#B25A2E] hover:bg-[#F7E9DF]" aria-label={`Remove ${item.name}`}><V3Icon name="trash" className="h-4 w-4" /></button></article>)}</div>}
      <div className="mt-auto rounded-[18px] bg-[radial-gradient(circle_at_100%_0%,rgba(200,155,60,.22),transparent_55%),#0A1F3A] p-5 text-white">
        <div className="space-y-2 text-xs text-white/70"><p className="flex justify-between"><span>Subtotal</span><span>{props.formatPrice(props.subtotal)}</span></p><p className="flex justify-between"><span>Delivery</span><span>{props.formatPrice(props.delivery)}</span></p></div>
        <p className="mt-3 flex justify-between border-t border-white/15 pt-3 font-serif text-lg font-bold"><span>Total</span><span>{props.formatPrice(props.total)}</span></p>
        <button type="button" onClick={props.onCheckout} className="mt-4 w-full rounded-[11px] bg-[linear-gradient(#C89B3C,#B3872F)] px-4 py-3 text-sm font-bold text-[#0A1F3A]">{props.checkoutLabel}</button>
      </div>
    </div>
  </Drawer>;
}
