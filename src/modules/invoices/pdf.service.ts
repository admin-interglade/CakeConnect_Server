import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { config } from "../../config/index.js";

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shop: {
    shopName: string;
    shopCode?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstin?: string | null;
  };
  orderNumber?: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    tax: number;
    discount: number;
    totalAmount: number;
  }>;
}

function money(n: number): string {
  return `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  const startY = 240;
  const colWidths = [150, 40, 80, 70, 70, 90];
  const x0 = 50;
  const headers = ["Item", "Qty", "Unit Price", "Tax", "Discount", "Amount"];

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
  doc.rect(x0, startY, colWidths.reduce((a, b) => a + b, 0), 20).fill("#b45309");

  let x = x0;
  headers.forEach((h, i) => {
    doc.fillColor("#ffffff").text(h, x + 6, startY + 6, { width: colWidths[i] - 6 });
    x += colWidths[i];
  });
  doc.fillColor("#000000");
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  item: InvoicePdfData["items"][number],
  y: number,
) {
  const colWidths = [150, 40, 80, 70, 70, 90];
  const x0 = 50;

  doc.font("Helvetica").fontSize(9);
  let x = x0;
  const cells = [
    item.productName,
    String(item.quantity),
    money(item.unitPrice),
    money(item.tax),
    money(item.discount),
    money(item.totalAmount),
  ];
  cells.forEach((cell, i) => {
    doc.text(cell, x + 6, y + 4, { width: colWidths[i] - 6 });
    x += colWidths[i];
  });
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<string> {
  const dir = path.join(config.uploadsDir, "invoices");
  fs.mkdirSync(dir, { recursive: true });

  const safeInvoiceNo = data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "");
  const filePath = path.join(dir, `${safeInvoiceNo}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    doc.pipe(stream);

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#b45309").text("CakeConnect", 50, 50);
    doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text("Invoice / Tax Invoice", 50, 78);

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("INVOICE", 50, 105);

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Invoice No:", 360, 105);
    doc.font("Helvetica").fillColor("#374151").text(data.invoiceNumber, 430, 105);

    doc.font("Helvetica-Bold").fillColor("#111827").text("Invoice Date:", 360, 122);
    doc.font("Helvetica").fillColor("#374151").text(formatDate(data.invoiceDate), 430, 122);

    doc.font("Helvetica-Bold").fillColor("#111827").text("Due Date:", 360, 139);
    doc.font("Helvetica").fillColor("#374151").text(formatDate(data.dueDate), 430, 139);

    if (data.orderNumber) {
      doc.font("Helvetica-Bold").fillColor("#111827").text("Order:", 360, 156);
      doc.font("Helvetica").fillColor("#374151").text(data.orderNumber, 430, 156);
    }

    const billToY = 190;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#b45309").text("Billed To", 50, billToY);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(data.shop.shopName, 50, billToY + 18);
    doc.font("Helvetica").fontSize(9).fillColor("#374151");
    if (data.shop.shopCode) doc.text(`Shop Code: ${data.shop.shopCode}`, 50, billToY + 32);
    const addrParts = [data.shop.address, [data.shop.city, data.shop.state].filter(Boolean).join(", "), data.shop.pincode].filter(Boolean);
    if (addrParts.length) doc.text(addrParts.join(", "), 50, billToY + 46);
    if (data.shop.gstin) doc.text(`GSTIN: ${data.shop.gstin}`, 50, billToY + 60);

    drawTableHeader(doc);

    let y = 260;
    data.items.forEach((item) => {
      drawTableRow(doc, item, y);
      y += 20;
    });

    y += 6;
    const summaries: Array<[string, string]> = [
      ["Subtotal", money(data.subtotal)],
      ["Tax", money(data.taxAmount)],
      ["Discount", money(data.discountAmount)],
      ["Total Amount", money(data.totalAmount)],
      ["Outstanding", money(data.totalAmount)],
    ];
    summaries.forEach(([label, value], i) => {
      const isTotal = label === "Total Amount" || label === "Outstanding";
      doc.font(isTotal ? "Helvetica-Bold" : "Helvetica").fontSize(isTotal ? 11 : 9);
      doc.fillColor("#374151").text(label, 400, y);
      doc.fillColor(isTotal ? "#b45309" : "#111827").text(value, 500, y);
      y += isTotal ? 24 : 18;
    });

    doc.font("Helvetica").fontSize(8).fillColor("#9ca3af").text(
      "This is a computer generated invoice. Thank you for your business.",
      50,
      doc.page.height - 60,
    );

    doc.end();
  });

  return filePath;
}
