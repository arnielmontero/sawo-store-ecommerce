import PDFDocument from "pdfkit";
import type { Order } from "@prisma/client";

// Matches the exact shape order.service.ts's getOrderById selects — not the
// full Prisma models, since that query only asks for sku/title, not every
// column on ProductVariant/Product.
type InvoiceOrder = Order & {
  user: { email: string } | null;
  items: { quantity: number; unitPriceCents: number; variant: { sku: string; product: { title: string } } }[];
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

// Builds a one-page invoice/receipt as a PDF Buffer, ready to send straight
// as an HTTP response body — same "returns a Buffer, caller sets headers"
// shape as lib/xlsx.ts's toXlsx, just a different document format. PDFKit
// draws programmatically (no HTML/browser involved), so layout is done by
// hand with explicit y-cursor tracking rather than CSS flow.
export function buildInvoicePdf(order: InvoiceOrder, storeName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text(storeName, { continued: false });
    doc.fontSize(10).font("Helvetica").fillColor("#666666").text("Invoice / Receipt");
    doc.moveDown(1.5);

    doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text(`Order ${order.reference}`);
    doc.fontSize(9).font("Helvetica").fillColor("#444444");
    doc.text(`Placed: ${order.createdAt.toLocaleDateString()}`);
    if (order.paidAt) doc.text(`Paid: ${order.paidAt.toLocaleDateString()}`);
    doc.text(`Status: ${order.status}`);
    if (order.user?.email) doc.text(`Customer: ${order.user.email}`);
    if (order.shippingAddress) doc.text(`Shipping address: ${order.shippingAddress}`);
    doc.moveDown(1);

    // ── Line items table ────────────────────────────────────────────────
    const tableTop = doc.y;
    const col = { item: 50, sku: 300, qty: 380, price: 430, total: 490 };
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
    doc.text("Item", col.item, tableTop);
    doc.text("SKU", col.sku, tableTop);
    doc.text("Qty", col.qty, tableTop);
    doc.text("Price", col.price, tableTop);
    doc.text("Total", col.total, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor("#dddddd").stroke();

    let y = tableTop + 20;
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    for (const item of order.items) {
      doc.text(item.variant.product.title, col.item, y, { width: 240 });
      doc.text(item.variant.sku, col.sku, y, { width: 70 });
      doc.text(String(item.quantity), col.qty, y);
      doc.text(money(item.unitPriceCents, order.currency), col.price, y);
      doc.text(money(item.unitPriceCents * item.quantity, order.currency), col.total, y);
      y += 18;
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#dddddd").stroke();
    y += 10;

    // ── Totals ───────────────────────────────────────────────────────────
    function totalRow(label: string, cents: number, bold = false) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5).fillColor("#000000");
      doc.text(label, 380, y, { width: 90 });
      doc.text(money(cents, order.currency), col.total, y);
      y += bold ? 18 : 15;
    }
    totalRow("Subtotal", order.subtotalCents);
    if (order.discountCents > 0) totalRow(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, -order.discountCents);
    totalRow("Shipping", order.shippingCents);
    totalRow("Tax", order.taxCents);
    y += 4;
    doc.moveTo(380, y).lineTo(545, y).strokeColor("#000000").stroke();
    y += 8;
    totalRow("Total", order.totalCents, true);
    if (order.refundedCents > 0) totalRow("Refunded", -order.refundedCents);

    doc.moveDown(3);
    doc.fontSize(8).fillColor("#999999").text(
      "This is a system-generated receipt. Thank you for your business.",
      50,
      doc.page.height - 80,
      { align: "center", width: 495 }
    );

    doc.end();
  });
}
