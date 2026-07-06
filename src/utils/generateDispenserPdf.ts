import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DispenserCycleItem, DispenserCycle } from '@/types/types';

// ─── colour constants ──────────────────────────────────────────────────────
const BLUE        = [37,  99, 235] as [number, number, number];
const DARK        = [17,  24,  39] as [number, number, number];
const GREY        = [107, 114, 128] as [number, number, number];
const LIGHT       = [249, 250, 251] as [number, number, number];
const BORDER_GRAY = [229, 231, 235] as [number, number, number];
const GREEN       = [22, 163, 74] as [number, number, number];

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const processLabel = (t: string) => t === 'sanitisation' ? 'Sanitisation' : 'Descaling';
const processColor = (t: string): [number, number, number] =>
  t === 'sanitisation' ? [22, 163, 74] : [37, 99, 235];

// ─────────────────────────────────────────────────────────────────────────────
// A. Individual Dispenser PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateIndividualDispenserPdf(
  item: DispenserCycleItem,
  processType: string,
  vendorName: string,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();   // 210
  const MARGIN = 14;
  const COL = (PAGE_W - MARGIN * 2) / 2 - 4;

  const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const pColor = processColor(processType);

  // Header
  doc.setFillColor(...pColor);
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DISPENSER SERVICE RECORD', PAGE_W / 2, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.text(processLabel(processType).toUpperCase(), PAGE_W / 2, 17, { align: 'center' });

  // Meta row
  let y = 30;
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(`Generated: ${genDate}`, MARGIN, y);
  doc.text(`Record ID: ${item.id.slice(0, 8).toUpperCase()}`, PAGE_W - MARGIN, y, { align: 'right' });

  // Info card
  y = 36;
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER_GRAY);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 48, 2, 2, 'FD');
  y += 7;

  const field = (label: string, val: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(label, x, yy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(val || '—', x, yy + 5);
  };

  field('DISPENSER SERIAL #', item.serial_number || '—', MARGIN + 4, y);
  field('MODEL', item.model || '—', MARGIN + 4 + COL + 4, y);
  y += 14;
  field('LOCATION / OFFICE', item.location_name || '—', MARGIN + 4, y);
  field('STATUS', item.status.replace(/_/g, ' ').toUpperCase(), MARGIN + 4 + COL + 4, y);
  y += 14;
  field('VENDOR', vendorName, MARGIN + 4, y);
  field('PROCESS TYPE', processLabel(processType), MARGIN + 4 + COL + 4, y);
  y += 18;

  // Section: Collection
  const sectionHeader = (title: string, yy: number) => {
    doc.setFillColor(...pColor);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.rect(MARGIN, yy, PAGE_W - MARGIN * 2, 7, 'F');
    doc.text(title, MARGIN + 3, yy + 5);
    return yy + 10;
  };

  y = sectionHeader('COLLECTION DETAILS', y);
  field('COLLECTED DATE', fmtDate(item.collected_date), MARGIN + 4, y);
  field('OFFICER NAME', item.collect_officer_name || '—', MARGIN + 4 + COL + 4, y);
  y += 14;

  // Collect officer signature
  if (item.collect_officer_signature_url) {
    const sigData = await urlToDataUrl(item.collect_officer_signature_url);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text('OFFICER SIGNATURE (COLLECTION)', MARGIN + 4, y);
    if (sigData) {
      doc.addImage(sigData, 'PNG', MARGIN + 4, y + 2, 60, 20);
    } else {
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.text('[Signature on file]', MARGIN + 4, y + 10);
    }
    y += 28;
  }

  // Section: Return
  y = sectionHeader('RETURN DETAILS', y + 4);
  field('RETURNED DATE', fmtDate(item.returned_date), MARGIN + 4, y);
  field('OFFICER NAME', item.return_officer_name || '—', MARGIN + 4 + COL + 4, y);
  y += 14;

  if (item.return_officer_signature_url) {
    const sigData = await urlToDataUrl(item.return_officer_signature_url);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text('OFFICER SIGNATURE (RETURN)', MARGIN + 4, y);
    if (sigData) {
      doc.addImage(sigData, 'PNG', MARGIN + 4, y + 2, 60, 20);
    } else {
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.text('[Signature on file]', MARGIN + 4, y + 10);
    }
    y += 28;
  }

  // Vendor signature
  y = sectionHeader('VENDOR SIGN-OFF', y + 4);
  if (item.vendor_signature_url) {
    const sigData = await urlToDataUrl(item.vendor_signature_url);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text('VENDOR SIGNATURE', MARGIN + 4, y);
    if (sigData) {
      doc.addImage(sigData, 'PNG', MARGIN + 4, y + 2, 60, 20);
    } else {
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.text('[Signature on file]', MARGIN + 4, y + 10);
    }
    y += 28;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text('No vendor signature yet.', MARGIN + 4, y + 5);
    y += 14;
  }

  // Descaling result attachment note (for descaling items)
  if (processType === 'descaling') {
    y += 4;
    y = sectionHeader('DESCALING RESULT', y);
    if (item.result_attachment_url) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GREY);
      doc.text('RESULT ATTACHMENT', MARGIN + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(item.result_attachment_url, MARGIN + 4, y + 6, { maxWidth: PAGE_W - MARGIN * 2 - 8 });
      y += 20;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text('No result attachment provided.', MARGIN + 4, y + 5);
      y += 14;
    }
  }

  // Admin approval section
  if (item.admin_full_name) {
    y = sectionHeader('ADMIN APPROVAL', y + 4);
    field('APPROVED BY', item.admin_full_name, MARGIN + 4, y);
    field('APPROVED DATE', fmtDate(item.admin_approved_at), MARGIN + 4 + COL + 4, y);
    y += 14;
    if (item.admin_signature_url) {
      const adminSigData = await urlToDataUrl(item.admin_signature_url);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GREY);
      doc.text('ADMIN SIGNATURE', MARGIN + 4, y);
      if (adminSigData) {
        doc.addImage(adminSigData, 'PNG', MARGIN + 4, y + 2, 60, 20);
      }
      y += 28;
    }
  }

  // Next due date & notes
  y += 4;
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER_GRAY);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 22, 2, 2, 'FD');
  field('NEXT DUE DATE', fmtDate(item.next_due_date), MARGIN + 4, y + 7);
  field('NOTES', item.notes || '—', MARGIN + 4, y + 16);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFillColor(...BORDER_GRAY);
  doc.rect(0, footerY - 4, PAGE_W, 12, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text('Water Distribution Management System', MARGIN, footerY);
  doc.text(`Page 1 of 1`, PAGE_W - MARGIN, footerY, { align: 'right' });

  return doc.output('blob');
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Cycle Summary PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateCycleSummaryPdf(
  cycle: DispenserCycle,
  items: DispenserCycleItem[],
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();  // 297
  const MARGIN = 14;
  const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const pColor = processColor(cycle.process_type);

  // Pre-fetch vendor signature
  const vendorSigData = cycle.vendor_signature_url
    ? await urlToDataUrl(cycle.vendor_signature_url) : null;

  // ── Page header helper ──
  let pageNum = 0;
  const drawHeader = () => {
    pageNum++;
    doc.setFillColor(...pColor);
    doc.rect(0, 0, PAGE_W, pageNum === 1 ? 20 : 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    if (pageNum === 1) {
      doc.setFontSize(14);
      doc.text(`DISPENSER ${processLabel(cycle.process_type).toUpperCase()} CYCLE SUMMARY`, PAGE_W / 2, 12, { align: 'center' });
    } else {
      doc.setFontSize(7);
      doc.text(`${processLabel(cycle.process_type)} Cycle Summary (continued)  —  Page ${pageNum}`, MARGIN, 5.5);
    }
  };

  drawHeader();

  // Cycle meta
  let y = 26;
  const field4 = (label: string, val: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(label, x, yy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(val || '—', x, yy + 5);
  };

  const Q = (PAGE_W - MARGIN * 2) / 4;
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER_GRAY);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 20, 2, 2, 'FD');
  field4('CYCLE ID', cycle.id.slice(0, 8).toUpperCase(), MARGIN + 4, y + 6);
  field4('VENDOR', cycle.vendor_full_name, MARGIN + 4 + Q, y + 6);
  field4('PROCESS', processLabel(cycle.process_type), MARGIN + 4 + Q * 2, y + 6);
  field4('STATUS', cycle.status.replace(/_/g, ' ').toUpperCase(), MARGIN + 4 + Q * 3, y + 6);
  y += 24;

  // Counts
  const totalItems = items.length;
  const completed = items.filter((i) => ['completed', 'approved'].includes(i.status)).length;
  const inProcess = items.filter((i) => ['collected', 'in_process', 'returned'].includes(i.status)).length;
  const pending   = items.filter((i) => i.status === 'pending').length;

  doc.setFillColor(...LIGHT);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 14, 2, 2, 'F');
  const cW = (PAGE_W - MARGIN * 2) / 4;
  const countBox = (label: string, count: number, x: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...DARK);
    doc.text(String(count), x + cW / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text(label, x + cW / 2, y + 12, { align: 'center' });
  };
  countBox('TOTAL', totalItems, MARGIN);
  countBox('COMPLETED', completed, MARGIN + cW);
  countBox('IN PROCESS', inProcess, MARGIN + cW * 2);
  countBox('PENDING', pending, MARGIN + cW * 3);
  y += 18;

  // Main table
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [[
      '#', 'Serial #', 'Model', 'Location',
      'Collected', 'Collect Officer',
      'Returned', 'Return Officer',
      'Status', 'Next Due',
    ]],
    body: items.map((item, idx) => [
      String(idx + 1),
      item.serial_number || '—',
      item.model || '—',
      item.location_name || '—',
      fmtDate(item.collected_date),
      item.collect_officer_name || '—',
      fmtDate(item.returned_date),
      item.return_officer_name || '—',
      item.status.replace(/_/g, ' ').toUpperCase(),
      fmtDate(item.next_due_date),
    ]),
    headStyles: { fillColor: pColor, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 0: { cellWidth: 8 }, 8: { cellWidth: 22 }, 9: { cellWidth: 22 } },
    didDrawPage: () => {
      if (pageNum > 1) drawHeader();
    },
  });

  // Vendor signature block
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (finalY < doc.internal.pageSize.getHeight() - 40) {
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...BORDER_GRAY);
    doc.roundedRect(MARGIN, finalY, 80, 32, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text('VENDOR SIGNATURE', MARGIN + 4, finalY + 6);
    if (vendorSigData) {
      doc.addImage(vendorSigData, 'PNG', MARGIN + 4, finalY + 8, 60, 20);
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK);
      doc.text(cycle.vendor_full_name, MARGIN + 4, finalY + 20);
    }

    // Admin approval block
    if (cycle.status === 'approved' && cycle.admin_full_name) {
      // Pre-fetch admin signature
      const adminSigData = cycle.admin_signature_url
        ? await urlToDataUrl(cycle.admin_signature_url) : null;

      doc.setFillColor(220, 252, 231);
      doc.setDrawColor(...GREEN);
      doc.roundedRect(MARGIN + 90, finalY, 120, 36, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...GREEN);
      doc.text('ADMIN APPROVED BY', MARGIN + 94, finalY + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK);
      doc.text(cycle.admin_full_name, MARGIN + 94, finalY + 13);
      doc.text(fmtDate(cycle.admin_approved_at), MARGIN + 94, finalY + 19);
      if (adminSigData) {
        doc.addImage(adminSigData, 'PNG', MARGIN + 94, finalY + 21, 60, 12);
      } else {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...GREY);
        doc.text('[Admin signature on file]', MARGIN + 94, finalY + 27);
      }
    }
  }

  // Footer
  const fY = doc.internal.pageSize.getHeight() - 6;
  doc.setFontSize(7); doc.setTextColor(...GREY);
  doc.text(`Generated: ${genDate}  —  Water Distribution Management System`, MARGIN, fY);

  return doc.output('blob');
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Monthly Payment PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMonthlyPaymentPdf(opts: {
  month: number;        // 1-12
  year: number;
  processType: string;  // 'sanitisation' | 'descaling' | 'both'
  vendorName: string;
  items: Array<DispenserCycleItem & { vendor_full_name?: string; process_type?: string }>;
  totalAmount?: number | null;
  adminApproved?: boolean;
  adminName?: string;
}): Promise<Blob> {
  const { month, year, processType, vendorName, items, totalAmount, adminApproved, adminName } = opts;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const MARGIN = 14;
  const pColor: [number, number, number] = processType === 'sanitisation' ? GREEN : processType === 'descaling' ? BLUE : [107, 33, 168];

  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Header
  doc.setFillColor(...pColor);
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DISPENSER SERVICE — MONTHLY PAYMENT REPORT', PAGE_W / 2, 12, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`${monthName}  |  ${processType === 'both' ? 'Sanitisation & Descaling' : processLabel(processType)}`, PAGE_W / 2, 18, { align: 'center' });

  // Meta
  let y = 28;
  doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text(`Vendor: ${vendorName}`, MARGIN, y);
  doc.text(`Generated: ${genDate}`, PAGE_W - MARGIN, y, { align: 'right' });
  y += 8;

  // Table
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [[
      '#', 'Serial #', 'Model', 'Location', 'Process', 'Collected', 'Returned',
      'Collect Officer', 'Return Officer', 'Status',
    ]],
    body: items.map((item, idx) => [
      String(idx + 1),
      item.serial_number || '—',
      item.model || '—',
      item.location_name || '—',
      item.process_type ? processLabel(item.process_type) : '—',
      fmtDate(item.collected_date),
      fmtDate(item.returned_date),
      item.collect_officer_name || '—',
      item.return_officer_name || '—',
      item.status.replace(/_/g, ' ').toUpperCase(),
    ]),
    headStyles: { fillColor: pColor, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
  });

  const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Summary block
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER_GRAY);
  doc.roundedRect(MARGIN, tableEndY, PAGE_W - MARGIN * 2, 24, 2, 2, 'FD');

  const sumField = (label: string, val: string, x: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...GREY);
    doc.text(label, x, tableEndY + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK);
    doc.text(val, x, tableEndY + 15);
  };
  const qW = (PAGE_W - MARGIN * 2) / 4;
  sumField('TOTAL COMPLETED ITEMS', String(items.length), MARGIN + 4);
  sumField('VENDOR', vendorName, MARGIN + 4 + qW);
  sumField('TOTAL AMOUNT', totalAmount != null ? `$ ${totalAmount.toFixed(2)}` : 'N/A', MARGIN + 4 + qW * 2);
  sumField('ADMIN APPROVAL', adminApproved ? `Approved — ${adminName || ''}` : 'Pending', MARGIN + 4 + qW * 3);

  // Footer
  const fY = doc.internal.pageSize.getHeight() - 6;
  doc.setFontSize(7); doc.setTextColor(...GREY);
  doc.text('Water Distribution Management System  —  Confidential', MARGIN, fY);

  return doc.output('blob');
}
