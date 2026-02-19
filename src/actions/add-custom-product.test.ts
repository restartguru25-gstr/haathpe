import { describe, it, expect, vi, beforeEach } from "vitest";
import { addCustomProduct } from "./add-custom-product";
import { supabase } from "@/lib/supabase";
import { addCustomVendorMenuItem } from "@/lib/sales";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/lib/sales", () => ({
  addCustomVendorMenuItem: vi.fn(),
}));

describe("addCustomProduct", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: "mock-token" } },
      error: null,
    });
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: null });
    vi.mocked(addCustomVendorMenuItem).mockResolvedValue({ ok: true, id: "new-id" });
  });

  it("returns error when item name is empty", async () => {
    const result = await addCustomProduct({
      vendorId: "v1",
      item_name: "   ",
      custom_selling_price: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Item name");
  });

  it("returns error when price is invalid", async () => {
    const result = await addCustomProduct({
      vendorId: "v1",
      item_name: "Chai",
      custom_selling_price: NaN,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("price");
  });

  it("returns success from Edge Function when invoke succeeds", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { ok: true, id: "ef-id" },
      error: null,
    });

    const result = await addCustomProduct({
      vendorId: "v1",
      item_name: "Chai",
      custom_selling_price: 20,
      sort_order: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBe("ef-id");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("add-custom-product", {
      body: {
        item_name: "Chai",
        custom_selling_price: 20,
        sort_order: 0,
        gst_rate: 5,
      },
      headers: { Authorization: "Bearer mock-token" },
    });
  });

  it("falls back to direct Supabase when Edge Function fails and returns success", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: new Error("Network error"),
    });

    const result = await addCustomProduct({
      vendorId: "v1",
      item_name: "Pani Puri",
      custom_selling_price: 30,
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBe("new-id");
    expect(addCustomVendorMenuItem).toHaveBeenCalledWith("v1", {
      item_name: "Pani Puri",
      custom_selling_price: 30,
      sort_order: 0,
      gst_rate: 5,
    });
  });

  it("returns error when fallback also fails", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: new Error("fail") });
    vi.mocked(addCustomVendorMenuItem).mockResolvedValue({ ok: false, error: "RLS denied" });

    const result = await addCustomProduct({
      vendorId: "v1",
      item_name: "Item",
      custom_selling_price: 15,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("RLS denied");
  });
});
