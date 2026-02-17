import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, FileJson, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/AuthContext";
import { getVendorMenuItems } from "@/lib/sales";
import { buildOndcCatalog } from "@/lib/ondc";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/contexts/AppContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function OndcExport() {
  const { t } = useApp();
  const { user } = useSession();
  const vendorId = user?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    id: string;
    name: string | null;
    stall_type: string | null;
    stall_address: string | null;
    zone: string | null;
  } | null>(null);
  const [menuItems, setMenuItems] = useState<{
    id: string;
    item_name: string;
    description: string | null;
    custom_selling_price: number;
    image_url: string | null;
    gst_rate: number;
  }[]>([]);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    Promise.all([
      supabase.from("profiles").select("id, name, stall_type, stall_address, zone").eq("id", vendorId).single(),
      getVendorMenuItems(vendorId),
    ]).then(([profileRes, items]) => {
      setProfile(profileRes.data as typeof profile | null);
      setMenuItems(
        items.map((m) => ({
          id: m.id,
          item_name: m.item_name,
          description: m.description,
          custom_selling_price: m.custom_selling_price,
          image_url: m.image_url,
          gst_rate: m.gst_rate,
        }))
      );
      setLoading(false);
    });
  }, [vendorId]);

  const handleDownload = () => {
    if (!profile) return;
    const json = buildOndcCatalog(profile, menuItems);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ondc-catalog-${profile.name?.replace(/\s+/g, "-") || "vendor"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="container max-w-lg px-4 py-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-28">
      <div className="container max-w-lg px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">{t("catalogExport")}</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <FileJson className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">{t("catalogExportTitle")}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("catalogExportDesc")}
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Items: {menuItems.length} | Vendor: {profile?.name || "—"}
          </p>
          <Button onClick={handleDownload} className="gap-2" disabled={menuItems.length === 0}>
            <Download size={18} /> Download JSON Catalog
          </Button>
          {menuItems.length === 0 && (
            <p className="mt-2 text-xs text-amber-600">Add menu items in Sales first.</p>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">{t("catalogExportFutureTitle")}</p>
          <p>{t("catalogExportFutureDesc")}</p>
        </div>
      </div>
    </div>
  );
}
