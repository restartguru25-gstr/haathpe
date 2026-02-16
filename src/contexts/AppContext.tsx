import React, { createContext, useContext, useState, useCallback } from "react";
import { CartItem, Product, Language, translations } from "@/lib/data";

export interface CartVariant {
  variantId: string;
  variantLabel: string;
  pricePaise: number;
  gstRate: number;
  mrpPaise?: number;
}

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

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lang, setLang] = useState<Language>("en");

  const t = useCallback(
    (key: keyof typeof translations.en) => translations[lang][key] || key,
    [lang]
  );

  const cartKey = (i: CartItem) => `${i.product.id}:${i.variantId ?? ""}`;

  const addToCart = useCallback((product: Product, qty = 1, variant?: CartVariant) => {
    setCart((prev) => {
      const key = `${product.id}:${variant?.variantId ?? ""}`;
      const existing = prev.find((i) => cartKey(i) === key);
      if (existing) {
        return prev.map((i) =>
          cartKey(i) === key ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [
        ...prev,
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
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setCart((prev) =>
      prev.filter(
        (i) => !(i.product.id === productId && (i.variantId ?? "") === (variantId ?? ""))
      )
    );
  }, []);

  const updateQty = useCallback((productId: string, qty: number, variantId?: string) => {
    const key = `${productId}:${variantId ?? ""}`;
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => cartKey(i) !== key));
    } else {
      setCart((prev) =>
        prev.map((i) => (cartKey(i) === key ? { ...i, qty } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = cart.reduce(
    (sum, i) => sum + (i.pricePaise != null ? (i.pricePaise * i.qty) / 100 : i.product.price * i.qty),
    0
  );
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <AppContext.Provider
      value={{ cart, lang, setLang, t, addToCart, removeFromCart, updateQty, clearCart, cartTotal, cartCount }}
    >
      {children}
    </AppContext.Provider>
  );
};
