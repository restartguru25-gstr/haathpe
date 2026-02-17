/**
 * Transaction history for SVANidhi / proof of business.
 * Fetches vendor's purchases (orders) and sales (customer_orders), exports as PDF or CSV.
 */
import { jsPDF } from "jspdf";
import { supabase } from "./supabase";
import { getCustomerOrders } from "./sales";

export interface PurchaseRow {
  date: string;
  id: string;
  type: "purchase";
  description: string;
  total: number;
  items: { name: string; qty: number; unit_price: number; amount: number }[];
}

export interface SaleRow {
  date: string;
  id: string;
  type: "sale";
  description: string;
  total: number;
  items: { name: string; qty: number; price: number; amount: number }[];
}

export interface TransactionHistoryData {
  vendorName: string;
  generatedAt: string;
  fromDate: string;
  toDate: string;
  purchases: PurchaseRow[];
  sales: SaleRow[];
  totalPurchases: number;
  totalSales: number;
}

export async function fetchTransactionHistory(userId: string, vendorName: string): Promise<TransactionHistoryData> {
  const [purchasesRes, salesList] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, created_at, order_items(product_name, qty, unit_price)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    getCustomerOrders(userId, { limit: 500 }),
  ]);

  const purchaseRows: PurchaseRow[] = [];
  let totalPurchases = 0;
  if (purchasesRes.data && purchasesRes.error == null) {
    for (const o of purchasesRes.data as Array<{
      id: string;
      total: number;
      created_at: string;
      order_items?: Array<{ product_name: string; qty: number; unit_price: number }>;
    }>) {
      const items = (o.order_items ?? []).map((row) => ({
        name: row.product_name,
        qty: row.qty,
        unit_price: row.unit_price,
        amount: row.qty * row.unit_price,
      }));
      purchaseRows.push({
        date: new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        id: o.id,
        type: "purchase",
        description: `Purchase #${o.id.slice(0, 8)}`,
        total: o.total,
        items,
      });
      totalPurchases += o.total;
    }
  }

  const saleRows: SaleRow[] = [];
  let totalSales = 0;
  for (const o of salesList) {
    const items = (o.items ?? []).map((line) => ({
      name: line.item_name,
      qty: line.qty,
      price: line.price,
      amount: line.qty * line.price,
    }));
    saleRows.push({
      date: new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      id: o.id,
      type: "sale",
      description: `Sale #${o.id.slice(0, 8)}`,
      total: Number(o.total),
      items,
    });
    totalSales += Number(o.total);
  }

  const purchaseDates = (purchasesRes.data ?? []).map((o: { created_at: string }) => new Date(o.created_at).getTime());
  const saleDates = salesList.map((o) => new Date(o.created_at).getTime());
  const allTimestamps = [...purchaseDates, ...saleDates];
  const fromDate =
    allTimestamps.length === 0
      ? new Date().toLocaleDateString("en-IN")
      : new Date(Math.min(...allTimestamps)).toLocaleDateString("en-IN");
  const toDate =
    allTimestamps.length === 0
      ? new Date().toLocaleDateString("en-IN")
      : new Date(Math.max(...allTimestamps)).toLocaleDateString("en-IN");

  return {
    vendorName,
    generatedAt: new Date().toISOString(),
    fromDate,
    toDate,
    purchases: purchaseRows,
    sales: saleRows,
    totalPurchases,
    totalSales,
  };
}

function escapeCsvCell(s: string): string {
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function downloadTransactionHistoryCsv(data: TransactionHistoryData): void {
  const rows: string[] = [
    "Transaction History – For SVANidhi / proof of business",
    `Dukaanwaala,${escapeCsvCell(data.vendorName)}`,
    `Generated,${escapeCsvCell(new Date(data.generatedAt).toLocaleString("en-IN"))}`,
    `Period,${escapeCsvCell(data.fromDate)} to ${escapeCsvCell(data.toDate)}`,
    "",
    "Date,Type,Description,Amount (₹),Details",
  ];

  for (const p of data.purchases) {
    const details = p.items.map((i) => `${i.name} × ${i.qty} @ ₹${i.unit_price}`).join("; ");
    rows.push(`${escapeCsvCell(p.date)},Purchase,${escapeCsvCell(p.description)},${p.total},${escapeCsvCell(details)}`);
  }
  for (const s of data.sales) {
    const details = s.items.map((i) => `${i.name} × ${i.qty} @ ₹${i.price}`).join("; ");
    rows.push(`${escapeCsvCell(s.date)},Sale,${escapeCsvCell(s.description)},${s.total},${escapeCsvCell(details)}`);
  }

  rows.push("", `Total Purchases (₹),${data.totalPurchases}`, `Total Sales (₹),${data.totalSales}`);

  const blob = new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `haathpe-Transaction-History-${data.vendorName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildTransactionHistoryPdf(data: TransactionHistoryData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = 18;

  doc.setFontSize(16);
  doc.text("Transaction History – For SVANidhi / proof of business", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Dukaanwaala: ${data.vendorName}`, margin, y);
  y += 5;
  doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString("en-IN")}`, margin, y);
  y += 5;
  doc.text(`Period: ${data.fromDate} to ${data.toDate}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  const colW = [22, 12, 50, 28, 28];
  const headers = ["Date", "Type", "Description", "Details", "Amount (₹)"];

  const addTable = (title: string, rows: { date: string; type: string; desc: string; details: string; amount: number }[]) => {
    if (y > 250) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    headers.forEach((h, i) => {
      const x = margin + colW.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(h, x, y);
    });
    y += 6;
    for (const r of rows) {
      if (y > 265) {
        doc.addPage();
        y = 18;
      }
      const details = r.details.length > 35 ? r.details.slice(0, 34) + "…" : r.details;
      const texts = [r.date, r.type, r.desc.length > 22 ? r.desc.slice(0, 21) + "…" : r.desc, details, `₹${r.amount}`];
      texts.forEach((t, i) => {
        const x = margin + colW.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(t, x, y);
      });
      y += 6;
    }
    y += 6;
  };

  const purchaseTable = data.purchases.map((p) => ({
    date: p.date,
    type: "Purchase",
    desc: p.description,
    details: p.items.map((i) => `${i.name} × ${i.qty}`).join(", ") || "—",
    amount: p.total,
  }));
  if (purchaseTable.length) addTable("Purchases (catalog orders)", purchaseTable);

  const saleTable = data.sales.map((s) => ({
    date: s.date,
    type: "Sale",
    desc: s.description,
    details: s.items.map((i) => `${i.name} × ${i.qty}`).join(", ") || "—",
    amount: s.total,
  }));
  if (saleTable.length) addTable("Sales (customer orders)", saleTable);

  if (y > 250) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.text(`Total Purchases: ₹${data.totalPurchases}`, margin, y);
  y += 6;
  doc.text(`Total Sales: ₹${data.totalSales}`, margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.text("Use this document as proof of business for PM SVANidhi loan application.", margin, y);

  return doc;
}

export function downloadTransactionHistoryPdf(data: TransactionHistoryData): void {
  const doc = buildTransactionHistoryPdf(data);
  const filename = `haathpe-Transaction-History-${data.vendorName.replace(/\s+/g, "-").slice(0, 20)}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/** Share PDF via Web Share API if available (e.g. mobile); otherwise downloads. */
export function shareOrDownloadTransactionHistory(
  data: TransactionHistoryData,
  format: "pdf" | "csv",
  onDone: () => void
): void {
  if (format === "csv") {
    downloadTransactionHistoryCsv(data);
    onDone();
    return;
  }
  const doc = buildTransactionHistoryPdf(data);
  const blob = doc.output("blob");
  const file = new File(
    [blob],
    `haathpe-Transaction-History-${data.vendorName.replace(/\s+/g, "-").slice(0, 20)}-${new Date().toISOString().slice(0, 10)}.pdf`,
    { type: "application/pdf" }
  );
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    navigator
      .share({
        title: "Transaction History – SVANidhi proof",
        text: `Transaction history for ${data.vendorName}. Use for PM SVANidhi loan application.`,
        files: [file],
      })
      .then(() => onDone())
      .catch(() => {
        downloadTransactionHistoryPdf(data);
        onDone();
      });
  } else {
    downloadTransactionHistoryPdf(data);
    onDone();
  }
}
