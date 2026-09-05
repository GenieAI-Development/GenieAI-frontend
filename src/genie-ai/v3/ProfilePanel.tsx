import type { GenieProduct } from "./types";
import { ProductGrid } from "./ProductGrid";
import type { PreviousOrder } from "../types";
import { V3Icon } from "./Icon";

type Props = {
  addLabel: string;
  cartIds: Set<string>;
  compareIds: string[];
  favoriteIds: Set<string>;
  favorites: GenieProduct[];
  formatPrice: (price: number, currency: string) => string;
  onAdd: (product: GenieProduct) => void;
  onCompare: (id: string) => void;
  onFavorite: (product: GenieProduct) => void;
  onView: (product: GenieProduct) => void;
  onWishlist: (product: GenieProduct) => void;
  previousOrders: PreviousOrder[];
  viewLabel: string;
  wishlist: GenieProduct[];
  wishlistIds: Set<string>;
};

export function ProfilePanel(props: Props) {
  const gridProps = {
    addLabel: props.addLabel,
    cartIds: props.cartIds,
    compact: true,
    compareIds: props.compareIds,
    favoriteIds: props.favoriteIds,
    formatPrice: props.formatPrice,
    isLoading: false,
    onAdd: props.onAdd,
    onCompare: props.onCompare,
    onFavorite: props.onFavorite,
    onView: props.onView,
    onWishlist: props.onWishlist,
    viewLabel: props.viewLabel,
    wishlistIds: props.wishlistIds,
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-8">
      <header className="overflow-hidden rounded-[22px] border border-[#D7E2EF] bg-[linear-gradient(120deg,#F7F3E8,#E7EEF7_60%,#F8FBFF)] p-5 shadow-[0_12px_28px_-20px_rgba(10,31,58,.45)] sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-[#0B2748] text-[#F6ECD3] shadow-sm"><V3Icon name="person" className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#B3872F]">Your profile</p>
            <h1 className="mt-1 text-2xl font-bold text-[#0A1F3A]">Saved products & orders</h1>
            <p className="mt-1 text-sm text-[#5B6B7A]">Your saved items help GenieAI make more relevant recommendations.</p>
          </div>
          <div className="flex gap-2 text-center text-xs font-semibold text-[#123661]">
            <span className="rounded-xl border border-white bg-white/80 px-3 py-2"><strong className="block text-base">{props.favorites.length}</strong>Favorites</span>
            <span className="rounded-xl border border-white bg-white/80 px-3 py-2"><strong className="block text-base">{props.wishlist.length}</strong>Wishlist</span>
            <span className="rounded-xl border border-white bg-white/80 px-3 py-2"><strong className="block text-base">{props.previousOrders.length}</strong>Orders</span>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-bold text-[#0A1F3A]">Favorites <span className="text-sm font-medium text-[#5B6B7A]">({props.favorites.length})</span></h2>
        <ProductGrid {...gridProps} emptyLabel="Your favorite products will appear here." products={props.favorites} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-[#0A1F3A]">Wishlist <span className="text-sm font-medium text-[#5B6B7A]">({props.wishlist.length})</span></h2>
        <ProductGrid {...gridProps} emptyLabel="Products saved for later will appear here." products={props.wishlist} />
      </section>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-[#0A1F3A]">Previous orders <span className="text-sm font-medium text-[#5B6B7A]">({props.previousOrders.length})</span></h2>
        {props.previousOrders.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#E4E1D8] bg-white p-5 text-sm leading-6 text-[#5B6B7A]">Completed orders will appear here.</div>
        ) : (
          <div className="grid gap-3">
            {props.previousOrders.map((order) => (
              <article key={order.id} className="rounded-[16px] border border-[#E4E1D8] bg-white p-4 shadow-[0_6px_18px_-12px_rgba(10,31,58,.18)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#0A1F3A]">Order {order.id.slice(0, 8).toUpperCase()}</h3>
                    <p className="mt-0.5 text-xs text-[#5B6B7A]">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</p>
                  </div>
                  <p className="text-sm font-bold text-[#123661]">{props.formatPrice(order.total, order.items[0]?.currency ?? "LKR")}</p>
                </div>
                <ul className="mt-3 space-y-1 border-t border-[#E4E1D8] pt-3 text-xs text-[#3E4A56]">
                  {order.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span className="truncate">{item.name}</span><span className="shrink-0 font-semibold">{props.formatPrice(item.price, item.currency)}</span></li>)}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
