import { useMemo } from "react";
import type { CartItem } from "@/lib/data";

export interface CartPricing {
  /** Sum of line totals (₹) - GST inclusive */
  subtotalInclusive: number;
  /** Sum of taxable values (₹) for invoice */
  subtotalTaxable: number;
  /** Total GST amount (₹) */
  gstTotal: number;
  /** Slab discount amount (₹) */
  slabDiscount: number;
  /** Final amount after slab (₹) */
  finalTotal: number;
  /** Slab rate applied (0, 0.05, 0.1) */
  slabRate: number;
}

export function useCartPricing(cart: CartItem[]): CartPricing {
  return useMemo(() => {
    let subtotalInclusive = 0;
    let subtotalTaxable = 0;
    let gstTotal = 0;

    for (const i of cart) {
      const lineTotalRupees =
        i.pricePaise != null ? (i.pricePaise * i.qty) / 100 : i.product.price * i.qty;
      subtotalInclusive += lineTotalRupees;
      if (i.gstRate != null && i.gstRate > 0) {
        const taxable = lineTotalRupees / (1 + i.gstRate / 100);
        subtotalTaxable += taxable;
        gstTotal += lineTotalRupees - taxable;
      } else {
        subtotalTaxable += lineTotalRupees;
      }
    }

    const slabRate = subtotalInclusive >= 10000 ? 0.1 : subtotalInclusive >= 5000 ? 0.05 : 0;
    const slabDiscount = Math.round(subtotalInclusive * slabRate * 100) / 100;
    const finalTotal = Math.round((subtotalInclusive - slabDiscount) * 100) / 100;

    return {
      subtotalInclusive,
      subtotalTaxable,
      gstTotal,
      slabDiscount,
      finalTotal,
      slabRate,
    };
  }, [cart]);
}
