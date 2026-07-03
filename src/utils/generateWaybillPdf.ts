import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Delivery, DeliveryLocationItem } from '@/types/types';

// ─── helpers ───────────────────────────────────────────────────────────────

/** Fetch a remote URL and return a base64 data-URL for jsPDF.addImage */
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── main export ───────────────────────────────────────────────────────────

export async function generateWaybillPdf(
  delivery: Delivery & { vendor?: { full_name: string; email: string } },
  items: DeliveryLocationItem[],
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const PAGE_W  = doc.internal.pageSize.getWidth();  // 297 mm
  const PAGE_H  = doc.internal.pageSize.getHeight(); // 210 mm
  const MARGIN  = 14;
  const CONTENT_W = PAGE_W - MARGIN * 2;             // 269 mm

  // ── colour palette ────────────────────────────────────────────────────────
  const BLUE        = [37,  99,  235] as [number, number, number];
  const DARK        = [17,  24,  39 ] as [number, number, number];
  const GREY        = [107, 114, 128] as [number, number, number];
  const LIGHT       = [249, 250, 251] as [number, number, number];
  const BORDER_GRAY = [229, 231, 235] as [number, number, number];

  // ── derived values ────────────────────────────────────────────────────────
  const vendorName    = delivery.vendor_full_name || delivery.vendor?.full_name || '—';
  const deliveryDate  = delivery.delivery_date ?? '—';
  const reportId      = (delivery.id ?? '').slice(0, 8).toUpperCase();
  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const totalIssued   = items.reduce((s, i) => s + (i.issued_quantity   ?? 0), 0);
  const totalReceived = items.reduce((s, i) => s + (i.received_quantity ?? 0), 0);

  // ── Pre-fetch ALL signature images in parallel ────────────────────────────
  const officerSigUrls = items.map((i) => i.officer_signature_url ?? null);

  const [vendorSigDataUrl, adminSigDataUrl, ...officerSigDataUrls] = await Promise.all([
    delivery.vendor_signature_url ? urlToDataUrl(delivery.vendor_signature_url) : Promise.resolve(null),
    delivery.admin_signature_url  ? urlToDataUrl(delivery.admin_signature_url)  : Promise.resolve(null),
    ...officerSigUrls.map((u) => u ? urlToDataUrl(u) : Promise.resolve(null)),
  ]);

  // ── Helper: draw the blue header bar (called on every page) ───────────────
  const drawPageHeader = (pageNum: number) => {
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, PAGE_W, pageNum === 1 ? 18 : 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    if (pageNum === 1) {
      doc.setFontSize(15);
      doc.text('WATER BOTTLES DELIVERY WAYBILL', PAGE_W / 2, 11.5, { align: 'center' });
    } else {
      doc.setFontSize(7);
      doc.text('WATER BOTTLES DELIVERY WAYBILL  (continued)', MARGIN, 5.5);
    }
  };

  // ── PAGE 1 header ─────────────────────────────────────────────────────────
  drawPageHeader(1);
  let curY = 24;

  // Meta row: 4 info boxes
  const boxW = (CONTENT_W - 9) / 4;
  const metaFields = [
    { label: 'DELIVERY DATE', value: deliveryDate  },
    { label: 'VENDOR',        value: vendorName     },
    { label: 'REPORT ID',     value: reportId       },
    { label: 'GENERATED',     value: generatedDate  },
  ];
  metaFields.forEach((f, i) => {
    const x = MARGIN + i * (boxW + 3);
    doc.setDrawColor(...BORDER_GRAY);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, curY, boxW, 14, 2, 2, 'FD');
    doc.setTextColor(...GREY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(f.label, x + 4, curY + 5);
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(String(f.value), x + 4, curY + 11, { maxWidth: boxW - 6 });
  });
  curY += 20;

  // Section title
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`DELIVERY LOCATIONS  (${items.length})`, MARGIN, curY);
  curY += 4;

  // ── Delivery table with officer-signature column ──────────────────────────
  // Col indices: 0=Route,1=Building,2=Office,3=SUP No.,4=Est.,5=Issued,6=Received,7=Officer,8=Officer Sig.
  const SIG_COL   = 8;
  const SIG_IMG_W = 22;   // image width inside cell (mm)
  const SIG_IMG_H = 14;   // image height inside cell (mm)
  const ROW_H     = 20;   // min row height to fit the signature image

  const tableBody = items.map((item, idx) => [
    String(item.route_number    ?? idx + 1),
    String(item.building_number ?? '—'),
    item.office_name ?? '—',
    item.sup_number  ?? '—',
    String(item.estimated_bottles ?? 0),
    String(item.issued_quantity   ?? 0),
    String(item.received_quantity ?? 0),
    item.no_issue_needed ? 'No Issue Req.' : (item.officer_name ?? '—'),
    '', // officer signature – drawn manually in didDrawCell
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Route', 'Building', 'Office', 'SUP No.', 'Est.', 'Issued', 'Received', 'Officer', 'Officer Sig.']],
    body: tableBody,
    foot: [[
      { content: 'TOTALS', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
      '',
      { content: String(totalIssued),   styles: { fontStyle: 'bold', halign: 'center' } },
      { content: String(totalReceived), styles: { fontStyle: 'bold', halign: 'center' } },
      '',
      '',
    ]],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    theme: 'grid',
    headStyles: {
      fillColor: BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    footStyles: {
      fillColor: LIGHT,
      textColor: DARK,
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: DARK,
      minCellHeight: ROW_H,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12  },
      1: { halign: 'center', cellWidth: 16  },
      2: { halign: 'left',   cellWidth: 'auto' },
      3: { halign: 'left',   cellWidth: 22  },
      4: { halign: 'center', cellWidth: 10  },
      5: { halign: 'center', cellWidth: 14  },
      6: { halign: 'center', cellWidth: 18  },
      7: { halign: 'left',   cellWidth: 34  },
      8: { halign: 'center', cellWidth: 28  },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    rowPageBreak: 'avoid',
    // Draw officer signature images inside cells
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === SIG_COL) {
        const rowIdx = data.row.index;
        const sigDataUrl = officerSigDataUrls[rowIdx];
        if (sigDataUrl) {
          // Centre the image within the cell
          const cx = data.cell.x + (data.cell.width  - SIG_IMG_W) / 2;
          const cy = data.cell.y + (data.cell.height - SIG_IMG_H) / 2;
          try {
            doc.addImage(sigDataUrl, 'PNG', cx, cy, SIG_IMG_W, SIG_IMG_H);
          } catch { /* skip if image decode fails */ }
        } else {
          // Dashed placeholder
          doc.setDrawColor(...BORDER_GRAY);
          doc.setLineDashPattern([1.5, 1.5], 0);
          const px = data.cell.x + 3;
          const py = data.cell.y + (data.cell.height - SIG_IMG_H) / 2;
          doc.rect(px, py, data.cell.width - 6, SIG_IMG_H);
          doc.setLineDashPattern([], 0);
          doc.setTextColor(...GREY);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.text('No sig.', px + (data.cell.width - 6) / 2, py + SIG_IMG_H / 2 + 1.5, { align: 'center' });
        }
      }
    },
    // Re-draw page header on every continuation page
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPageHeader(data.pageNumber);
    },
  });

  // ── Totals + Signatures section ───────────────────────────────────────────
  const afterTableY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  let sigY = afterTableY;

  // Push to a new page if < 58mm remain
  const SIG_BLOCK_H = 58;
  if (sigY + SIG_BLOCK_H > PAGE_H - MARGIN) {
    doc.addPage();
    drawPageHeader(doc.getNumberOfPages());
    sigY = 14;
  }

  // Summary highlight box
  doc.setDrawColor(...BLUE);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(MARGIN, sigY, CONTENT_W, 10, 2, 2, 'FD');
  doc.setTextColor(...BLUE);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `TOTAL ISSUES: ${totalIssued}     |     TOTAL RECEIVED: ${totalReceived}`,
    PAGE_W / 2, sigY + 6.5, { align: 'center' },
  );
  sigY += 14;

  // Section heading
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGNATURES', MARGIN, sigY);
  sigY += 5;

  // ── Draw vendor & admin signature cards ───────────────────────────────────
  const SIG_BOX_H = 36;
  const colW = (CONTENT_W - 8) / 2;

  const drawSigCard = (
    x: number, y: number, w: number,
    roleLabel: string, name: string,
    sigDataUrl: string | null,
    dateLabel: string, dateValue: string,
  ) => {
    doc.setDrawColor(...BORDER_GRAY);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, w, SIG_BOX_H, 2, 2, 'FD');

    doc.setTextColor(...GREY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(roleLabel, x + 4, y + 6);

    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(name || '—', x + 4, y + 12, { maxWidth: w - 8 });

    const imgX = x + 4;
    const imgY = y + 15;
    const imgW = w - 8;
    const imgH = 14;

    if (sigDataUrl) {
      try {
        doc.addImage(sigDataUrl, 'PNG', imgX, imgY, imgW, imgH);
      } catch {
        drawDashedBox(imgX, imgY, imgW, imgH, 'Signature unavailable');
      }
    } else {
      drawDashedBox(imgX, imgY, imgW, imgH, 'No signature');
    }

    doc.setTextColor(...GREY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${dateLabel}: ${dateValue}`, x + 4, y + SIG_BOX_H - 3);
  };

  const drawDashedBox = (x: number, y: number, w: number, h: number, label: string) => {
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x, y, w, h);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...GREY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + w / 2, y + h / 2 + 2, { align: 'center' });
  };

  drawSigCard(
    MARGIN, sigY, colW,
    'VENDOR NAME', vendorName, vendorSigDataUrl,
    'Delivery Date', deliveryDate,
  );
  drawSigCard(
    MARGIN + colW + 8, sigY, colW,
    'ADMIN NAME', delivery.admin_full_name || '—', adminSigDataUrl,
    'Approved', delivery.approved_at
      ? new Date(delivery.approved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—',
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const safeVendor = vendorName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  doc.save(`Waybill_${deliveryDate}_${safeVendor}.pdf`);
}

