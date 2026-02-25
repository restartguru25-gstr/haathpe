/**
 * Shared invoice/receipt constants and helpers.
 * All invoices generated via the app include the Zenith Books marketing line.
 */

import { jsPDF } from "jspdf";

/** Single source of truth for the partner line on every invoice (vendor + customer). */
export const INVOICE_MARKETING_LINE =
  'This invoice was generated in association with Zenith Books — India\'s leading AI-powered accounting, taxation & compliance SaaS for MSMEs.';

/** Append marketing line to a list of text lines (for plain-text / print invoices). */
export function appendMarketingToLines(lines: string[]): string[] {
  return [...lines, "", "—", INVOICE_MARKETING_LINE];
}

/** Minimal customer order data for receipt generation. */
export interface CustomerReceiptData {
  id: string;
  created_at: string;
  status: string;
  vendor_name: string | null;
  items: { item_name: string; qty: number; price?: number }[];
  total: number;
}

function formatReceiptOrderId(id: string): string {
  return id.length > 12 ? `#${id.slice(0, 8)}` : id;
}

/** Build plain-text receipt lines for customer order (includes marketing line). */
export function buildCustomerReceiptLines(receipt: CustomerReceiptData): string[] {
  const dateStr = new Date(receipt.created_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const lines: string[] = [
    "haathpe – Receipt / Tax Invoice",
    "------------------------",
    `Order: ${formatReceiptOrderId(receipt.id)}`,
    `Date: ${dateStr}`,
    `Status: ${receipt.status}`,
    `Vendor: ${receipt.vendor_name ?? "—"}`,
    "",
    "Items",
    "------",
  ];
  for (const item of receipt.items) {
    const price = item.price != null ? item.price : 0;
    const amount = price * item.qty;
    lines.push(`${item.item_name} × ${item.qty} = ₹${amount}`);
  }
  if (receipt.items.length === 0) {
    lines.push("Order total");
  }
  lines.push("------", `Total: ₹${receipt.total}`, "", "Thank you for your order.");
  return appendMarketingToLines(lines);
}

/** Generate and download customer receipt as PDF (includes marketing line). */
export function downloadCustomerReceiptPdf(receipt: CustomerReceiptData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFontSize(18);
  doc.text("haathpe – Receipt / Tax Invoice", 14, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date(receipt.created_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Order: ${formatReceiptOrderId(receipt.id)}`, 14, y);
  doc.text(dateStr, pageW - 14, y, { align: "right" });
  y += 6;
  doc.text(`Status: ${receipt.status}`, 14, y);
  doc.text(`Vendor: ${receipt.vendor_name ?? "—"}`, 14, y + 6);
  doc.setTextColor(0, 0, 0);
  y += 14;

  if (receipt.items.length > 0) {
    const colW = [100, 22, 30, 38];
    const headers = ["Item", "Qty", "Unit ₹", "Amount"];
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => {
      const x = 14 + colW.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(h, x, y);
    });
    y += 7;
    doc.setFont("helvetica", "normal");
    for (const item of receipt.items) {
      const price = item.price != null ? item.price : 0;
      const amount = price * item.qty;
      const name = item.item_name.length > 36 ? item.item_name.slice(0, 36) + "…" : item.item_name;
      if (y > 265) {
        doc.addPage();
        y = 18;
      }
      doc.text(name, 14, y);
      doc.text(String(item.qty), 14 + colW[0], y);
      doc.text(`₹${price}`, 14 + colW[0] + colW[1], y);
      doc.text(`₹${amount}`, 14 + colW[0] + colW[1] + colW[2], y);
      y += 6;
    }
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Total: ₹${receipt.total}`, 14, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Thank you for your order.", 14, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(INVOICE_MARKETING_LINE, 14, y, { maxWidth: pageW - 28 });

  const filename = `haathpe-receipt-${receipt.id.replace(/-/g, "").slice(0, 12)}.pdf`;
  doc.save(filename);
}
