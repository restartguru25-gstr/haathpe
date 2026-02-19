import React, { createContext, useContext, useState, useCallback } from "react";
import type { Product, Language } from "@/lib/data";
import { translations } from "@/lib/data";
import { useCartStore, selectTotal, selectCartCount, type CartVariant } from "@/store/cartStore";

interface AppState {
  cart: CartItem[];
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof typeof translations.en) => string;
  addToCart: (product: Product, qty?: number, variant?: CartVariant) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQty: (productId: string, qty: number, variantId?: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

export type { CartVariant };

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>("en");
  const cart = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartTotal = useCartStore(selectTotal);
  const cartCount = useCartStore(selectCartCount);

  const t = useCallback(
    (key: keyof typeof translations.en) => translations[lang][key] || key,
    [lang]
  );

  const addToCart = useCallback(
    (product: Product, qty = 1, variant?: CartVariant) => addItem(product, qty, variant),
    [addItem]
  );

  const removeFromCart = useCallback(
    (productId: string, variantId?: string) => removeItem(productId, variantId),
    [removeItem]
  );

  const updateQty = useCallback(
    (productId: string, qty: number, variantId?: string) =>
      updateQuantity(productId, qty, variantId),
    [updateQuantity]
  );

  return (
    <AppContext.Provider
      value={{ cart, lang, setLang, t, addToCart, removeFromCart, updateQty, clearCart, cartTotal, cartCount }}
    >
      {children}
    </AppContext.Provider>
  );
};
