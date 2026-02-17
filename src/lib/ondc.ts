/**
 * ONDC catalog export stub — Mystore/eSamudaay style
 * Generates JSON catalog from vendor_menu_items + profiles for ONDC seller app compatibility.
 * Full ONDC integration via API later.
 */

export interface VendorProfileForOndc {
  id: string;
  name: string | null;
  stall_type: string | null;
  stall_address: string | null;
  zone: string | null;
}

export interface MenuItemForOndc {
  id: string;
  item_name: string;
  description: string | null;
  custom_selling_price: number;
  image_url: string | null;
  gst_rate: number;
}

/** ONDC-compatible catalog item (simplified schema) */
export interface OndcCatalogItem {
  id: string;
  descriptor: {
    name: string;
    long_desc?: string;
    images?: { url: string }[];
  };
  price: {
    currency: string;
    value: string;
  };
  tax?: { rate: string };
}

/** Build ONDC-style catalog JSON for seller onboarding */
export function buildOndcCatalog(
  profile: VendorProfileForOndc,
  menuItems: MenuItemForOndc[]
): string {
  const items: OndcCatalogItem[] = menuItems.map((m) => ({
    id: m.id,
    descriptor: {
      name: m.item_name,
      long_desc: m.description || undefined,
      images: m.image_url && m.image_url.startsWith("http") ? [{ url: m.image_url }] : undefined,
    },
    price: {
      currency: "INR",
      value: String(Number(m.custom_selling_price).toFixed(2)),
    },
    tax: m.gst_rate > 0 ? { rate: `${m.gst_rate}%` } : undefined,
  }));

  const catalog = {
    context: {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      source: "haathpe",
      action: "catalog",
    },
    catalog: {
      descriptor: {
        name: "Haathpe Dukaan Catalog",
        long_desc: `Catalog export for ${profile.name || "Dukaanwaala"} - ${profile.stall_type || "Chhoti Dukaan"}`,
      },
      provider: {
        id: profile.id,
        descriptor: {
          name: profile.name || "Dukaanwaala",
          short_desc: profile.stall_type || undefined,
          long_desc: profile.stall_address || profile.zone || undefined,
        },
      },
      items,
      billing: {
        name: "INR",
        address: { locality: profile.zone || "Hyderabad", city: "Hyderabad", state: "TG" },
      },
    },
  };

  return JSON.stringify(catalog, null, 2);
}
