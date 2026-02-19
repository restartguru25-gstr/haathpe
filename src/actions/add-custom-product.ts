/**
 * Add custom product to vendor menu. Uses Edge Function first (avoids client AbortError),
 * falls back to direct Supabase insert if function not deployed.
 */
import { supabase } from "@/lib/supabase";
import { addCustomVendorMenuItem } from "@/lib/sales";

export interface AddCustomProductInput {
  vendorId: string;
  item_name: string;
  custom_selling_price: number;
  sort_order?: number;
  gst_rate?: number;
}

export interface AddCustomProductResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function addCustomProduct(
  input: AddCustomProductInput
): Promise<AddCustomProductResult> {
  const { vendorId, item_name, custom_selling_price, sort_order, gst_rate } = input;

  if (!item_name?.trim()) {
    return { ok: false, error: "Item name is required" };
  }
  if (Number.isNaN(custom_selling_price) || custom_selling_price < 0) {
    return { ok: false, error: "Valid price (₹) is required" };
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    if (token) {
      const { data, error } = await supabase.functions.invoke("add-custom-product", {
        body: {
          item_name: item_name.trim(),
          custom_selling_price,
          sort_order: sort_order ?? 0,
          gst_rate: gst_rate ?? 5,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!error && data?.ok) {
        if (import.meta.env.DEV) console.log("[add-custom-product] Edge Function success:", data);
        return { ok: true, id: data.id };
      }
      if (error) {
        if (import.meta.env.DEV) console.warn("[add-custom-product] Edge Function error, falling back:", error);
      }
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      if (import.meta.env.DEV) console.warn("[add-custom-product] Edge Function aborted, falling back");
    } else {
      if (import.meta.env.DEV) console.warn("[add-custom-product] Edge Function failed:", e);
    }
  }

  const result = await addCustomVendorMenuItem(vendorId, {
    item_name: item_name.trim(),
    custom_selling_price,
    sort_order: sort_order ?? 0,
    gst_rate: gst_rate ?? 5,
  });

  if (result.ok && import.meta.env.DEV) {
    console.log("[add-custom-product] Direct Supabase success:", result.id);
  }
  if (!result.ok && import.meta.env.DEV) {
    console.error("[add-custom-product] Direct Supabase error:", result.error);
  }

  return result;
}
