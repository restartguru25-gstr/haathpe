import { Link } from "react-router-dom";
import { MapPin, Heart, Store, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { VendorSearchResult } from "@/lib/vendorSearch";
import { useApp } from "@/contexts/AppContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { toggleFavoriteVendor } from "@/lib/customer";

interface VendorCardProps {
  vendor: VendorSearchResult;
  onFavoriteChange?: () => void;
  /** Preserve rider attribution when user came from rider QR (search?rider=...) */
  riderParam?: string;
}

export default function VendorCard({ vendor, onFavoriteChange, riderParam }: VendorCardProps) {
  const { t } = useApp();
  const { customer, refreshCustomer } = useCustomerAuth();
  const favoriteVendorIds = customer?.favorite_vendor_ids ?? [];
  const isFavorite = favoriteVendorIds.includes(vendor.vendor_id);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!customer) return;
    const res = await toggleFavoriteVendor(
      customer.id,
      vendor.vendor_id,
      favoriteVendorIds
    );
    if (res.ok) await refreshCustomer();
    onFavoriteChange?.();
  }

  const location = [vendor.zone, vendor.address].filter(Boolean).join(" · ") || t("searchZoneGeneral");

  return (
    <Card className="h-full flex flex-col border-border/80 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{vendor.name || t("searchVendorUnknown")}</h3>
              {vendor.premium_tier === "premium" && (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-0.5">
                  <Sparkles size={10} /> Premium
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{vendor.stall_type || t("searchStallTypeAll")}</p>
          </div>
        </div>
        {customer && (
          <button
            type="button"
            onClick={handleToggleFavorite}
            className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label={isFavorite ? t("removeFromFavorites") : t("addToFavorites")}
          >
            <Heart
              className={`h-5 w-5 ${isFavorite ? "fill-destructive text-destructive" : ""}`}
            />
          </button>
        )}
      </CardHeader>
      <CardContent className="pb-2 flex-1">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{location}</span>
        </div>
        {vendor.menu_preview.length > 0 && (
          <ul className="text-sm text-foreground/90 space-y-0.5">
            {vendor.menu_preview.slice(0, 3).map((item, i) => (
              <li key={i} className="truncate flex justify-between gap-2">
                <span className="truncate">{item.item_name}</span>
                <span className="text-muted-foreground shrink-0">₹{Number(item.price)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {vendor.avg_rating != null && vendor.avg_rating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {vendor.avg_rating}
            </span>
          )}
          <span>{vendor.order_count} {t("searchOrdersLabel")}</span>
        </div>
        {vendor.stall_type && /panipuri|pani|snacks|food|tiffin|chai|tea|beverage|fast food/i.test(vendor.stall_type) && (
          <Link to="/catalog" className="mt-2 block text-xs text-primary hover:underline">
            {t("searchUpsellSupplies")}
          </Link>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Link
          to={riderParam ? `/menu/${vendor.vendor_id}?rider=${encodeURIComponent(riderParam)}` : `/menu/${vendor.vendor_id}`}
          className="w-full"
        >
          <Button variant="default" size="sm" className="w-full">
            {t("viewMenu")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
