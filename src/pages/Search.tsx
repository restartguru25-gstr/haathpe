import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getVendorSearchResults,
  SEARCH_ZONES,
  SEARCH_STALL_TYPES,
  SORT_OPTIONS,
  type VendorSearchResult,
  type VendorSearchFilters,
} from "@/lib/vendorSearch";
import VendorCard from "@/components/VendorCard";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { useApp } from "@/contexts/AppContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import type { TranslationKey } from "@/lib/data";

const ZONE_LABELS: Record<string, string> = {
  "": "searchZoneAll",
  Charminar: "Charminar",
  "Hi-Tech City": "Hi-Tech City",
  Secunderabad: "Secunderabad",
  "Banjara Hills": "Banjara Hills",
  Kukatpally: "Kukatpally",
  Gachibowli: "Gachibowli",
  General: "General",
};

export default function Search() {
  const { t } = useApp();
  const { customer } = useCustomerAuth();
  const [keyword, setKeyword] = useState("");
  const [zone, setZone] = useState("");
  const [stallType, setStallType] = useState("");
  const [sort, setSort] = useState<VendorSearchFilters["sort"]>("popular");
  const [results, setResults] = useState<VendorSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setSearchError(null);
    const res = await getVendorSearchResults({
      keyword: keyword.trim() || undefined,
      zone: zone || undefined,
      stallType: stallType || undefined,
      sort,
    });
    setResults(res.data ?? []);
    if (res.error) setSearchError(res.error);
    setLoading(false);
  }, [keyword, zone, stallType, sort]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const favoriteVendorIds = customer?.favorite_vendor_ids ?? [];
  const sortedResults =
    customer && favoriteVendorIds.length > 0
      ? [...results].sort((a, b) => {
          const aFav = favoriteVendorIds.includes(a.vendor_id) ? 1 : 0;
          const bFav = favoriteVendorIds.includes(b.vendor_id) ? 1 : 0;
          return bFav - aFav;
        })
      : results;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link to="/" className="brand-haathpe shrink-0 text-lg font-medium">
            haathpe
          </Link>
          <h1 className="text-sm font-medium text-muted-foreground truncate">
            {t("searchTitle")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="space-y-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("searchZoneAll")}</option>
              {SEARCH_ZONES.filter((z) => z !== "").map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABELS[z] ?? z}
                </option>
              ))}
            </select>
            <select
              value={stallType}
              onChange={(e) => setStallType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SEARCH_STALL_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey as TranslationKey)}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as VendorSearchFilters["sort"])}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey as TranslationKey)}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={runSearch}>
              {t("searchFindVendors")}
            </Button>
          </div>
        </div>

        {searchError ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-6 text-center">
            <p className="font-medium text-amber-900 dark:text-amber-100">Search is temporarily unavailable</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200 font-mono break-all">
              {searchError}
            </p>
            {/ambiguous|42702/i.test(searchError) && (
              <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                To fix: open <strong>Supabase Dashboard → SQL Editor</strong>, run the contents of <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">supabase/migrations/20260220000000_fix_vendor_search_ambiguous_vendor_id.sql</code>. Ensure you run it on the same project as <code className="text-xs">VITE_SUPABASE_URL</code> in your .env.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchError(null); runSearch(); }}>
              Try again
            </Button>
          </div>
        ) : loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : !searched ? null : sortedResults.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <MapPin className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("searchEmptyTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {t("searchEmptySubtitle")}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map((v) => (
              <VendorCard key={v.vendor_id} vendor={v} />
            ))}
          </div>
        )}
      </main>
      <MakeInIndiaFooter />
    </div>
  );
}
