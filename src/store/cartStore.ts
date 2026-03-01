import { create } from "zustand";
import type { CartItem, Product } from "@/lib/data";

export interface CartVariant {
  variantId: string;
  variantLabel: string;
  pricePaise: number;
  gstRate: number;
  mrpPaise?: number;
  /** Reference/market price (paise) for savings display */
  referencePricePaise?: number;
}

function cartKey(item: CartItem): string {
  return `${item.product.id}:${item.variantId ?? ""}`;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, qty?: number, variant?: CartVariant) => void;
  updateQuantity: (productId: string, qty: number, variantId?: string) => void;
  removeItem: (productId: string, variantId?: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product, qty = 1, variant) => {
    set((state) => {
      const key = `${product.id}:${variant?.variantId ?? ""}`;
      const existing = state.items.find((i) => cartKey(i) === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            cartKey(i) === key ? { ...i, qty: i.qty + qty } : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            product: variant
              ? { ...product, price: variant.pricePaise / 100 }
              : product,
            qty,
            variantId: variant?.variantId,
            variantLabel: variant?.variantLabel,
            pricePaise: variant?.pricePaise,
            gstRate: variant?.gstRate,
            mrpPaise: variant?.mrpPaise,
            referencePricePaise: variant?.referencePricePaise,
          },
        ],
      };
    });
  },

  updateQuantity: (productId, qty, variantId) => {
    const key = `${productId}:${variantId ?? ""}`;
    if (qty <= 0) {
      set((state) => ({
        items: state.items.filter((i) => cartKey(i) !== key),
      }));
    } else {
      set((state) => ({
        items: state.items.map((i) =>
          cartKey(i) === key ? { ...i, qty } : i
        ),
      }));
    }
  },

  removeItem: (productId, variantId) => {
    set((state) => ({
      items: state.items.filter(
        (i) => !(i.product.id === productId && (i.variantId ?? "") === (variantId ?? ""))
      ),
    }));
  },

  clearCart: () => set({ items: [] }),
}));

function computeTotal(items: CartItem[]): number {
  return items.reduce(
    (sum, i) =>
      sum +
      (i.pricePaise != null ? (i.pricePaise * i.qty) / 100 : i.product.price * i.qty),
    0
  );
}

function computeCartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

/** B2B savings vs reference price (paise). Returns { totalSavingsPaise, totalReferencePaise, percent }. */
function computeSavings(items: CartItem[]): {
  totalSavingsPaise: number;
  totalReferencePaise: number;
  percent: number;
} {
  let totalSavingsPaise = 0;
  let totalReferencePaise = 0;
  for (const i of items) {
    const refP = i.referencePricePaise ?? 0;
    const sellP = i.pricePaise != null ? i.pricePaise : Math.round((i.product.price ?? 0) * 100);
    if (refP > sellP) {
      totalSavingsPaise += (refP - sellP) * i.qty;
      totalReferencePaise += refP * i.qty;
    } else if (refP > 0) {
      totalReferencePaise += refP * i.qty;
    }
  }
  const percent =
    totalReferencePaise > 0 ? (totalSavingsPaise / totalReferencePaise) * 100 : 0;
  return { totalSavingsPaise, totalReferencePaise, percent };
}

/** Selectors for derived state */
export const selectTotal = (state: { items: CartItem[] }) => computeTotal(state.items);
export const selectCartCount = (state: { items: CartItem[] }) => computeCartCount(state.items);
export const selectSavings = (state: { items: CartItem[] }) => computeSavings(state.items);
