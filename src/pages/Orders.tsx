import { useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, FileText, Receipt, ChevronRight, Package, Printer, Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApp } from "@/contexts/AppContext";
import { getCatalogProductById } from "@/lib/catalog";
import { sampleOrders, products, type Product } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const FILTERS = ["All", "Active", "Past"] as const;

type Filter = (typeof FILTERS)[number];

interface DisplayOrder {
  id: string;
  total: number;
  date: string;
  status: "pending" | "delivered" | "in-transit";
  gst_total?: number | null;
  subtotal_before_tax?: number | null;
  items?: { product: Product; qty: number; variant_id?: string | null; variant_label?: string | null; gst_rate?: number | null; unit_price?: number }[];
}

function getProductName(p: Product, lang: "en" | "hi" | "te"): string {
  if (lang === "hi") return p.nameHi;
  if (lang === "te") return p.nameTe;
  return p.name;
}

function formatOrderId(id: string): string {
  if (id.length > 12) return `#${id.slice(0, 8)}`;
  return id;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "delivered":
      return "bg-success/15 text-success border-success/30";
    case "in-transit":
      return "bg-accent/15 text-accent border-accent/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function Orders() {
  const { t, addToCart, lang } = useApp();
  const [filter, setFilter] = useState<Filter>("All");
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState<DisplayOrder | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id, total, status, created_at, gst_total, subtotal_before_tax, order_items(product_id, product_name, qty, unit_price, variant_label, gst_rate)")
          .order("created_at", { ascending: false });
        if (data && data.length > 0) {
          const orderItems = data as Array<{
            id: string;
            total: number;
            status: string;
            created_at: string;
            gst_total?: number | null;
            subtotal_before_tax?: number | null;
            order_items?: Array<{ product_id: string; product_name: string; qty: number; unit_price: number; variant_id?: string | null; variant_label?: string | null; gst_rate?: number | null }>;
          }>;
          setOrders(
            orderItems.map((o) => {
              const items = (o.order_items ?? []).map((row) => {
                const product = products.find((p) => p.id === row.product_id) ?? ({
                  id: row.product_id,
                  name: row.product_name,
                  nameHi: row.product_name,
                  nameTe: row.product_name,
                  price: row.unit_price,
                  image: "📦",
                  category: "",
                  eco: false,
                  description: "",
                  descriptionHi: "",
                  descriptionTe: "",
                } as Product);
                return {
                  product,
                  qty: row.qty,
                  variant_id: row.variant_id,
                  variant_label: row.variant_label,
                  gst_rate: row.gst_rate,
                  unit_price: row.unit_price,
                };
              });
              return {
                id: o.id,
                total: o.total,
                date: new Date(o.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
                status: o.status as "pending" | "delivered" | "in-transit",
                gst_total: o.gst_total,
                subtotal_before_tax: o.subtotal_before_tax,
                items,
              };
            })
          );
        } else {
          setOrders(
            sampleOrders.map((o) => ({
              id: o.id,
              total: o.total,
              date: o.date,
              status: o.status,
              items: o.items,
            }))
          );
        }
      } catch {
        setOrders(
          sampleOrders.map((o) => ({
            id: o.id,
            total: o.total,
            date: o.date,
            status: o.status,
            items: o.items,
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "Active") return orders.filter((o) => o.status !== "delivered");
    if (filter === "Past") return orders.filter((o) => o.status === "delivered");
    return orders;
  }, [orders, filter]);

  const handleReorder = async (order: DisplayOrder) => {
    if (!order.items || order.items.length === 0) {
      toast.info("Order details not available for reorder.");
      return;
    }
    for (const item of order.items) {
      const { product, qty, variant_id, variant_label, gst_rate } = item;
      const catalogProduct = await getCatalogProductById(product.id);
      const variants = catalogProduct?.product_variants ?? [];
      const variant =
        (variant_id && variants.find((v) => v.id === variant_id)) ||
        (variant_label && variants.find((v) => v.variant_label === variant_label));
      if (catalogProduct && variant) {
        const pricePaise = variant.variant_price;
        addToCart(
          {
            ...product,
            price: pricePaise / 100,
            name: catalogProduct.name,
            nameHi: catalogProduct.name_hi ?? catalogProduct.name,
            nameTe: catalogProduct.name_te ?? catalogProduct.name,
            image: catalogProduct.image_url ? "🛒" : product.image,
            category: "",
            eco: catalogProduct.is_eco,
            description: catalogProduct.description ?? "",
            descriptionHi: catalogProduct.description_hi ?? catalogProduct.description ?? "",
            descriptionTe: catalogProduct.description_te ?? catalogProduct.description ?? "",
          },
          qty,
          {
            variantId: variant.id,
            variantLabel: variant.variant_label,
            pricePaise,
            gstRate: gst_rate ?? catalogProduct.gst_rate ?? 0,
            mrpPaise: catalogProduct.mrp,
          }
        );
      } else {
        addToCart(product, qty);
      }
    }
    toast.success("Items added to cart!");
  };

  const handleInvoice = (order: DisplayOrder) => setInvoiceOrder(order);

  const handlePrintInvoice = () => {
    if (!invoiceOrder) return;
    const lines: string[] = [
      "VendorHub – Tax Invoice",
      "------------------------",
      `Order: ${formatOrderId(invoiceOrder.id)}`,
      `Date: ${invoiceOrder.date}`,
      `Status: ${invoiceOrder.status}`,
      "",
      "Items",
      "------",
    ];
    if (invoiceOrder.items?.length) {
      invoiceOrder.items.forEach((item) => {
        const name =
          getProductName(item.product, lang) + (item.variant_label ? ` — ${item.variant_label}` : "");
        lines.push(`${name} × ${item.qty} = ₹${item.product.price * item.qty}`);
      });
    } else {
      lines.push("Order total");
    }
    lines.push("------");
    if (invoiceOrder.subtotal_before_tax != null && invoiceOrder.gst_total != null) {
      lines.push(`Subtotal: ₹${invoiceOrder.subtotal_before_tax}`, `GST: ₹${invoiceOrder.gst_total}`);
    }
    lines.push(`Total: ₹${invoiceOrder.total}`, "", "Thank you for your order.");
    const text = lines.join("\n");
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<pre style="font-family:system-ui;padding:24px;max-width:400px;">${text.replace(/</g, "&lt;")}</pre>`);
      w.document.close();
      w.print();
      w.close();
    }
    toast.success("Print dialog opened");
  };

  const handleDownloadInvoice = () => {
    if (!invoiceOrder) return;
    const lines: string[] = [
      "VendorHub – Tax Invoice",
      "------------------------",
      `Order: ${formatOrderId(invoiceOrder.id)}`,
      `Date: ${invoiceOrder.date}`,
      `Status: ${invoiceOrder.status}`,
      "",
      "Items",
      "------",
    ];
    if (invoiceOrder.items?.length) {
      invoiceOrder.items.forEach((item) => {
        const name =
          getProductName(item.product, lang) + (item.variant_label ? ` — ${item.variant_label}` : "");
        lines.push(`${name} × ${item.qty} = ₹${item.product.price * item.qty}`);
      });
    } else {
      lines.push("Order total");
    }
    lines.push("------");
    if (invoiceOrder.subtotal_before_tax != null && invoiceOrder.gst_total != null) {
      lines.push(`Subtotal: ₹${invoiceOrder.subtotal_before_tax}`, `GST: ₹${invoiceOrder.gst_total}`);
    }
    lines.push(`Total: ₹${invoiceOrder.total}`, "", "Thank you for your order.");
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VendorHub-Invoice-${formatOrderId(invoiceOrder.id).replace("#", "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Invoice downloaded");
  };

  const handleDownloadPdfInvoice = () => {
    if (!invoiceOrder) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 18;

    doc.setFontSize(18);
    doc.text("VendorHub – Tax Invoice", 14, y);
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Order: ${formatOrderId(invoiceOrder.id)}`, 14, y);
    doc.text(`Date: ${invoiceOrder.date}`, pageW - 14, y, { align: "right" });
    y += 6;
    doc.text(`Status: ${invoiceOrder.status}`, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 12;

    if (invoiceOrder.items && invoiceOrder.items.length > 0) {
      const colW = [90, 18, 28, 22, 32];
      const headers = ["Item", "Qty", "Unit ₹", "GST %", "Amount"];
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      headers.forEach((h, i) => {
        const x = 14 + colW.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(h, x, y);
      });
      y += 7;
      doc.setFont("helvetica", "normal");

      invoiceOrder.items.forEach((item) => {
        const name =
          getProductName(item.product, lang) + (item.variant_label ? ` — ${item.variant_label}` : "");
        const qty = item.qty;
        const unit = item.product.price;
        const gstPct = item.gst_rate != null ? item.gst_rate : 0;
        const amount = item.product.price * item.qty;
        const texts = [
          name.length > 32 ? name.slice(0, 32) + "…" : name,
          String(qty),
          `₹${unit}`,
          `${gstPct}%`,
          `₹${amount}`,
        ];
        if (y > 260) {
          doc.addPage();
          y = 18;
        }
        texts.forEach((t, i) => {
          const x = 14 + colW.slice(0, i).reduce((a, b) => a + b, 0);
          doc.text(t, x, y);
        });
        y += 6;
      });
      y += 4;
    }

    if (invoiceOrder.subtotal_before_tax != null && invoiceOrder.gst_total != null) {
      doc.setFont("helvetica", "normal");
      doc.text(`Subtotal (before tax): ₹${invoiceOrder.subtotal_before_tax}`, 14, y);
      y += 6;
      doc.text(`GST: ₹${invoiceOrder.gst_total}`, 14, y);
      y += 6;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ₹${invoiceOrder.total}`, 14, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for your order.", 14, y);

    const filename = `invoice-${invoiceOrder.id.replace(/-/g, "").slice(0, 12)}.pdf`;
    doc.save(filename);
    toast.success("GST invoice PDF downloaded");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <div className="container max-w-2xl px-4 py-6">
          <Skeleton className="mb-6 h-8 w-32" />
          <div className="mb-6 flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-16 rounded-full" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("orders")}</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "order" : "orders"}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Order list */}
        <AnimatePresence mode="wait">
          {filtered.length > 0 ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {filtered.map((order, i) => (
                <motion.article
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between p-4 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Receipt size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">{formatOrderId(order.id)}</p>
                        <p className="text-xs text-muted-foreground">{order.date}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusStyle(order.status)}`}
                    >
                      {order.status.replace("-", " ")}
                    </span>
                  </div>

                  {/* Line items (if available) */}
                  {order.items && order.items.length > 0 ? (
                    <div className="border-t border-border px-4 py-3">
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {item.product.image}{" "}
                              {getProductName(item.product, lang)} × {item.qty}
                            </span>
                            <span className="font-medium">
                              ₹{item.product.price * item.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-border px-4 py-2">
                      <p className="text-xs text-muted-foreground">Order total</p>
                    </div>
                  )}

                  {/* Total & actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
                    <p className="text-base font-bold">₹{order.total}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => handleInvoice(order)}
                      >
                        <FileText size={14} /> Invoice
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleReorder(order)}
                        disabled={!order.items || order.items.length === 0}
                      >
                        <RotateCcw size={14} /> {t("reorder")}
                      </Button>
                    </div>
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
              <h2 className="mb-1 text-lg font-semibold">No orders found</h2>
              <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
                {filter === "All"
                  ? "You haven't placed any orders yet. Browse the catalog and place your first order."
                  : `No ${filter.toLowerCase()} orders.`}
              </p>
              {filter !== "All" ? (
                <Button variant="outline" onClick={() => setFilter("All")}>
                  Show all orders
                </Button>
              ) : (
                <Link to="/catalog">
                  <Button className="gap-2">
                    <ChevronRight size={16} className="-ml-1" />
                    Browse catalog
                  </Button>
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Invoice sheet */}
      <Sheet open={!!invoiceOrder} onOpenChange={(open) => !open && setInvoiceOrder(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Invoice {invoiceOrder ? formatOrderId(invoiceOrder.id) : ""}</SheetTitle>
          </SheetHeader>
          {invoiceOrder && (
            <div className="mt-6 space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Date: {invoiceOrder.date}</span>
                <span className="capitalize">{invoiceOrder.status.replace("-", " ")}</span>
              </div>
              {invoiceOrder.items && invoiceOrder.items.length > 0 ? (
                <div className="rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="p-3 text-left font-semibold">Item</th>
                        <th className="p-3 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceOrder.items.map((item, idx) => (
                        <tr key={`${item.product.id}-${idx}`} className="border-b border-border">
                          <td className="p-3">
                            {item.product.image}{" "}
                            {getProductName(item.product, lang)}
                            {item.variant_label ? ` — ${item.variant_label}` : ""} × {item.qty}
                            {item.gst_rate != null && item.gst_rate > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({t("gst")} {item.gst_rate}%)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium">
                            ₹{item.product.price * item.qty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Order total</p>
              )}
              {invoiceOrder.subtotal_before_tax != null && invoiceOrder.gst_total != null && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>{t("subtotal")}</span>
                    <span>₹{invoiceOrder.subtotal_before_tax}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t("gstAmount")}</span>
                    <span>₹{invoiceOrder.gst_total}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-border pt-3 text-lg font-bold">
                <span>{t("total")}</span>
                <span>₹{invoiceOrder.total}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handlePrintInvoice} className="flex-1 min-w-[100px] gap-2">
                  <Printer size={16} /> Print
                </Button>
                <Button variant="outline" onClick={handleDownloadInvoice} className="flex-1 min-w-[100px] gap-2">
                  <Download size={16} /> TXT
                </Button>
                <Button variant="outline" onClick={handleDownloadPdfInvoice} className="flex-1 min-w-[100px] gap-2">
                  <FileDown size={16} /> PDF
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
