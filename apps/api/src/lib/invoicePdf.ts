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
    // Columns widened/spaced so real SKUs (e.g. "DOOR-CDR-CLR") fit on one
    // line at this font size — col widths intentionally sum to fit within
    // the 495pt content area (545 - 50 margins).
    const col = { item: 50, sku: 250, qty: 340, price: 390, total: 460 };
    const BOTTOM_MARGIN = 90; // leaves room for the totals block + footer below the last row
    const ROW_HEIGHT = 18;

    function drawTableHeader() {
      const headerY = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
      doc.text("Item", col.item, headerY);
      doc.text("SKU", col.sku, headerY);
      doc.text("Qty", col.qty, headerY);
      doc.text("Price", col.price, headerY);
      doc.text("Total", col.total, headerY);
      doc.moveTo(50, headerY + 14).lineTo(545, headerY + 14).strokeColor("#dddddd").stroke();
      return headerY + 20;
    }

    let y = drawTableHeader();
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    for (const item of order.items) {
      // A long product title can still wrap onto a second line even with
      // the widened columns — measure it and advance by whichever row is
      // taller, so a wrapped title never overlaps the next row.
      const titleHeight = doc.heightOfString(item.variant.product.title, { width: 190 });
      const rowHeight = Math.max(ROW_HEIGHT, titleHeight + 4);

      if (y + rowHeight > doc.page.height - BOTTOM_MARGIN) {
        doc.addPage();
        y = drawTableHeader();
        doc.font("Helvetica").fontSize(9).fillColor("#333333");
      }

      doc.text(item.variant.product.title, col.item, y, { width: 190 });
      doc.text(item.variant.sku, col.sku, y, { width: 80 });
      doc.text(String(item.quantity), col.qty, y);
      doc.text(money(item.unitPriceCents, order.currency), col.price, y);
      doc.text(money(item.unitPriceCents * item.quantity, order.currency), col.total, y);
      y += rowHeight;
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#dddddd").stroke();
    y += 10;

    // Totals need their own space below the table — if the last item row
    // left too little room, start the totals block on a fresh page rather
    // than letting it run off the bottom.
    const TOTALS_BLOCK_HEIGHT = 100;
    if (y + TOTALS_BLOCK_HEIGHT > doc.page.height - 50) {
      doc.addPage();
      y = 50;
    }

    // ── Totals ───────────────────────────────────────────────────────────
    // Label column ends where the amount column (col.total) begins, so a
    // longer label like "Discount (SAVE10)" never collides with the number.
    const totalsLabelX = 300;
    function totalRow(label: string, cents: number, bold = false) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5).fillColor("#000000");
      doc.text(label, totalsLabelX, y, { width: col.total - totalsLabelX - 5 });
      doc.text(money(cents, order.currency), col.total, y);
      y += bold ? 18 : 15;
    }
    totalRow("Subtotal", order.subtotalCents);
    if (order.discountCents > 0) totalRow(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, -order.discountCents);
    totalRow("Shipping", order.shippingCents);
    totalRow("Tax", order.taxCents);
    y += 4;
    doc.moveTo(totalsLabelX, y).lineTo(545, y).strokeColor("#000000").stroke();
    y += 8;
    totalRow("Total", order.totalCents, true);
    if (order.refundedCents > 0) totalRow("Refunded", -order.refundedCents);

    // Positioned relative to where the totals block actually ended, not a
    // fixed page offset — on a multi-page invoice the totals land on
    // whichever page had room, and the footer must follow them there
    // rather than risk landing mid-content or off the bottom of the page.
    doc.fontSize(8).fillColor("#999999").text(
      "This is a system-generated receipt. Thank you for your business.",
      50,
      y + 24,
      { align: "center", width: 495 }
    );

    doc.end();
  });
}
