import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Leaf,
  ShoppingCart,
  X,
  ChevronDown,
  Package,
  SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useApp } from "@/contexts/AppContext";
import { products, type Product, getProductDescription } from "@/lib/data";
import {
  getSectors,
  getCategories,
  getCatalogProducts,
  formatINR,
  type Sector,
  type Category,
  type CatalogProduct,
  type ProductVariant,
} from "@/lib/catalog";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const CATEGORIES = ["All", "Essentials", "Disposables", "Kits"] as const;

const SORT_OPTIONS = [
  { id: "default", labelKey: "default" as const },
  { id: "price-asc", labelKey: "sortPriceAsc" as const },
  { id: "price-desc", labelKey: "sortPriceDesc" as const },
  { id: "name", labelKey: "sortName" as const },
] as const;

function getProductName(p: Product, lang: "en" | "hi" | "te"): string {
  if (lang === "hi") return p.nameHi;
  if (lang === "te") return p.nameTe;
  return p.name;
}

function catalogProductToProduct(p: CatalogProduct, variant?: ProductVariant): Product {
  const price = variant ? variant.variant_price / 100 : p.selling_price / 100;
  const name = p.name + (variant ? ` (${variant.variant_label})` : "");
  return {
    id: p.id,
    name,
    nameHi: (p.name_hi ?? p.name) + (variant ? ` (${variant.variant_label})` : ""),
    nameTe: (p.name_te ?? p.name) + (variant ? ` (${variant.variant_label})` : ""),
    price,
    image: p.image_url ?? "📦",
    category: (p.categories as Category)?.name ?? "",
    eco: p.is_eco,
    description: p.description ?? "",
    descriptionHi: p.description_hi ?? "",
    descriptionTe: p.description_te ?? "",
  };
}

export default function Catalog() {
  const { t, addToCart, cartCount, lang } = useApp();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [ecoOnly, setEcoOnly] = useState(false);
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["id"]>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [sectorId, setSectorId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [detailCatalog, setDetailCatalog] = useState<CatalogProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    const load = async () => {
      const [s, c, prods] = await Promise.all([
        getSectors(),
        getCategories(),
        getCatalogProducts({ limit: 100 }),
      ]);
      setSectors(s);
      setCategories(c);
      setCatalogProducts(prods);
      setCatalogLoading(false);
    };
    load();
  }, []);

  const catalogCategories = useMemo(
    () => (sectorId ? categories.filter((c) => c.sector_id === sectorId) : categories),
    [sectorId, categories]
  );

  const catalogFiltered = useMemo(() => {
    let list = catalogProducts;
    if (categoryId) list = list.filter((p) => p.category_id === categoryId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
      );
    }
    if (ecoOnly) list = list.filter((p) => p.is_eco);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.selling_price - b.selling_price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.selling_price - a.selling_price);
    else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [catalogProducts, categoryId, search, ecoOnly, sort]);

  const useCatalogMode = catalogProducts.length > 0 && !catalogLoading;

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (ecoOnly && !p.eco) return false;
      const name = getProductName(p, lang);
      if (
        search &&
        !name.toLowerCase().includes(search.toLowerCase()) &&
        !getProductDescription(p, lang).toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });

    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "name") list = [...list].sort((a, b) => getProductName(a, lang).localeCompare(getProductName(b, lang)));

    return list;
  }, [search, category, ecoOnly, sort, lang]);

  const handleAdd = (product: Product, qty = 1) => {
    addToCart(product, qty);
    toast.success(`${getProductName(product, lang)} ${t("addedToCart")}`);
    setDetailProduct(null);
  };

  const handleAddCatalog = (p: CatalogProduct, qty: number, variant?: ProductVariant | null) => {
    const product = catalogProductToProduct(p, variant ?? undefined);
    if (variant) {
      addToCart(product, qty, {
        variantId: variant.id,
        variantLabel: variant.variant_label,
        pricePaise: variant.variant_price,
        gstRate: p.gst_rate,
        mrpPaise: p.mrp,
      });
    } else {
      addToCart(product, qty, {
        variantId: "",
        variantLabel: "",
        pricePaise: p.selling_price,
        gstRate: p.gst_rate,
        mrpPaise: p.mrp,
      });
    }
    toast.success(`${product.name} ${t("addedToCart")}`);
    setDetailCatalog(null);
    setSelectedVariant(null);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setEcoOnly(false);
    setSort("default");
    setSectorId("");
    setCategoryId("");
  };

  const hasActiveFilters =
    search ||
    category !== "All" ||
    ecoOnly ||
    sort !== "default" ||
    (useCatalogMode && (sectorId || categoryId));
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.labelKey ? t(SORT_OPTIONS.find((o) => o.id === sort)!.labelKey) : "Sort";

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{t("catalog")}</h1>
            <p className="text-sm text-muted-foreground">
              {useCatalogMode
                ? `${catalogFiltered.length} ${catalogFiltered.length === 1 ? "product" : "products"}`
                : `${filtered.length} ${filtered.length === 1 ? "product" : "products"}`}
            </p>
          </div>
          <Link to="/cart" className="flex justify-end sm:block">
            <Button variant="outline" size="lg" className="relative gap-2">
              <ShoppingCart size={18} />
              {t("cart")}
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={t("searchProducts")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sector (catalog mode) */}
        {useCatalogMode && (
          <div className="mb-4">
            <Label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t("allSectors")}
            </Label>
            <select
              value={sectorId}
              onChange={(e) => {
                setSectorId(e.target.value);
                setCategoryId("");
              }}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium"
              aria-label={t("allSectors")}
            >
              <option value="">{t("allSectors")}</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category (catalog mode: from Supabase categories) */}
        {useCatalogMode && catalogCategories.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryId("")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                !categoryId
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("all")}
            </button>
            {catalogCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  categoryId === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Filters row */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap gap-2">
            {!useCatalogMode &&
              CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    category === c
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {c === "All" ? t("all") : t(c.toLowerCase() as "essentials" | "disposables" | "kits")}
                </button>
              ))}
            <button
              onClick={() => setEcoOnly(!ecoOnly)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                ecoOnly
                  ? "bg-success text-success-foreground shadow-sm"
                  : "bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
              }`}
            >
              <Leaf size={14} /> {t("eco")}
            </button>
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted"
            >
              <SlidersHorizontal size={14} />
              {sortLabel}
              <ChevronDown
                size={14}
                className={`transition-transform ${sortOpen ? "rotate-180" : ""}`}
              />
            </button>
            {sortOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setSortOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-card py-1 shadow-lg">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSort(opt.id);
                        setSortOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm ${
                        sort === opt.id
                          ? "bg-primary/10 font-semibold text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </motion.div>
        )}

        {/* Product grid */}
        <AnimatePresence mode="wait">
          {useCatalogMode ? (
            catalogFiltered.length > 0 ? (
              <motion.div
                key="catalog-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 gap-4 sm:grid-cols-3"
              >
                {catalogFiltered.map((p, i) => (
                  <motion.article
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                    className="group flex flex-col rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                  >
                    <button
                      type="button"
                      className="flex flex-1 flex-col p-4 text-left"
                      onClick={() => {
                        setDetailCatalog(p);
                        setSelectedVariant(
                          p.product_variants?.length ? p.product_variants[0] ?? null : null
                        );
                      }}
                      aria-label={`View ${p.name} details`}
                    >
                      <div className="relative mb-3">
                        <div className="flex h-20 items-center justify-center rounded-lg bg-muted/50 text-4xl">
                          {p.image_url ?? "📦"}
                        </div>
                        {p.is_eco && (
                          <span className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-success/15">
                            <Leaf size={14} className="text-success" />
                          </span>
                        )}
                        {p.discount_percent > 0 && (
                          <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                            {p.discount_percent}% OFF
                          </span>
                        )}
                      </div>
                      <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-tight">
                        {lang === "hi" ? p.name_hi ?? p.name : lang === "te" ? p.name_te ?? p.name : p.name}
                      </h3>
                      <div className="mb-1 flex items-center gap-2">
                        {p.mrp > p.selling_price && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatINR(p.mrp)}
                          </span>
                        )}
                        <span className="text-lg font-bold text-primary">
                          {formatINR(p.selling_price)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t("gst")}: {p.gst_rate}%
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground mt-1">
                        {lang === "hi" ? p.description_hi ?? p.description : lang === "te" ? p.description_te ?? p.description : p.description}
                      </p>
                    </button>
                    <div className="p-4 pt-0">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.product_variants?.length) {
                            setDetailCatalog(p);
                            setSelectedVariant(p.product_variants[0] ?? null);
                          } else {
                            handleAddCatalog(p, 1);
                          }
                        }}
                      >
                        {t("addToCart")}
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="catalog-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 px-6"
              >
                <Package size={40} className="mb-4 text-muted-foreground" />
                <h2 className="mb-1 text-lg font-semibold">No products found</h2>
                <Button variant="outline" onClick={() => { setCategoryId(""); setSearch(""); setSectorId(""); }}>
                  Clear filters
                </Button>
              </motion.div>
            )
          ) : filtered.length > 0 ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3"
            >
              {filtered.map((product, i) => (
                <motion.article
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.2) }}
                  className="group flex flex-col rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <button
                    type="button"
                    className="flex flex-1 flex-col p-4 text-left"
                    onClick={() => setDetailProduct(product)}
                  >
                    <div className="relative mb-3">
                      <div className="flex h-20 items-center justify-center rounded-lg bg-muted/50 text-4xl">
                        {product.image}
                      </div>
                      {product.eco && (
                        <span className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-success/15">
                          <Leaf size={14} className="text-success" />
                        </span>
                      )}
                    </div>
                    <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-tight">
                      {getProductName(product, lang)}
                    </h3>
                    <p className="mb-3 text-lg font-bold text-primary">
                      ₹{product.price}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {getProductDescription(product, lang)}
                    </p>
                  </button>
                  <div className="p-4 pt-0">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd(product);
                      }}
                    >
                      {t("addToCart")}
                    </Button>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 px-6"
            >
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Package size={40} className="text-muted-foreground" />
              </div>
              <h2 className="mb-1 text-lg font-semibold">No products found</h2>
              <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
                Try changing your search, category, or turn off the Eco filter.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Product detail sheet */}
      <Sheet open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            {detailProduct && (
              <>
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-4xl">
                    {detailProduct.image}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">
                      {getProductName(detailProduct, lang)}
                    </SheetTitle>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      ₹{detailProduct.price}
                    </p>
                    {detailProduct.eco && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                        <Leaf size={12} /> Eco-friendly
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetHeader>
          {detailProduct && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                {getProductDescription(detailProduct, lang)}
              </p>
              <p className="text-xs text-muted-foreground">
                Category: {detailProduct.category}
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => handleAdd(detailProduct)}
              >
                {t("addToCart")}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Catalog product detail sheet (with variant selector) */}
      <Sheet
        open={!!detailCatalog}
        onOpenChange={(open) => {
          if (!open) {
            setDetailCatalog(null);
            setSelectedVariant(null);
          }
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          {detailCatalog && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-4xl">
                    {detailCatalog.image_url ?? "📦"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle>
                      {lang === "hi"
                        ? detailCatalog.name_hi ?? detailCatalog.name
                        : lang === "te"
                          ? detailCatalog.name_te ?? detailCatalog.name
                          : detailCatalog.name}
                    </SheetTitle>
                    <div className="mt-1 flex items-center gap-2">
                      {detailCatalog.mrp > detailCatalog.selling_price && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatINR(detailCatalog.mrp)}
                        </span>
                      )}
                      <span className="text-2xl font-bold text-primary">
                        {selectedVariant
                          ? formatINR(selectedVariant.variant_price)
                          : formatINR(detailCatalog.selling_price)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("gst")}: {detailCatalog.gst_rate}%
                    </p>
                    {detailCatalog.is_eco && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                        <Leaf size={12} /> Eco-friendly
                      </span>
                    )}
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {lang === "hi"
                    ? detailCatalog.description_hi ?? detailCatalog.description
                    : lang === "te"
                      ? detailCatalog.description_te ?? detailCatalog.description
                      : detailCatalog.description}
                </p>
                {detailCatalog.product_variants && detailCatalog.product_variants.length > 0 && (
                  <div>
                    <Label className="mb-2 block text-sm font-medium">
                      Select quantity / size
                    </Label>
                    <RadioGroup
                      value={selectedVariant?.id ?? ""}
                      onValueChange={(id) => {
                        const v = detailCatalog.product_variants?.find((x) => x.id === id);
                        setSelectedVariant(v ?? null);
                      }}
                      aria-label={`Select ${detailCatalog.name} variant`}
                    >
                      {detailCatalog.product_variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center space-x-2 rounded-lg border border-border p-3"
                        >
                          <RadioGroupItem value={v.id} id={v.id} />
                          <Label
                            htmlFor={v.id}
                            className="flex flex-1 cursor-pointer justify-between font-normal"
                          >
                            <span>
                              {v.variant_label} — {formatINR(v.variant_price)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {v.variant_stock > 0 ? t("inStock") : t("outOfStock")}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() =>
                    handleAddCatalog(
                      detailCatalog,
                      1,
                      selectedVariant ?? undefined
                    )
                  }
                  disabled={
                    !!(
                      selectedVariant &&
                      selectedVariant.variant_stock <= 0
                    )
                  }
                >
                  {t("addToCart")}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
