import { jsPDF } from 'jspdf';
import worklenzLogo from '@/assets/images/worklenz-light-mode.png';

export interface AnalyticsPdfKpiTile {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}

export interface AnalyticsBrandedPdfOptions {
  title: string;
  filename: string;
  kpis?: AnalyticsPdfKpiTile[];
  chartPngDataUrl?: string | null;
  /**
   * Optional second chart (e.g. Project Health donut).
   * When set with `chartPngDataUrl`, charts render side-by-side at ~3/4 + ~1/4.
   */
  secondaryChartPngDataUrl?: string | null;
  /** First row = headers, following rows = data (same as the on-screen table). */
  tableRows?: string[][];
  /** Organization / team logo URL when available; falls back to Worklenz mark. */
  logoUrl?: string | null;
  exportedOn?: string;
  footerNote?: string;
}

const PAGE = {
  marginX: 40,
  marginTop: 28,
  marginBottom: 40,
  width: 841.89, // A4 landscape pt
  height: 595.28,
};

const TONES = {
  primary: '#1890ff',
  border: '#f0f0f0',
  text: '#262626',
  muted: '#8c8c8c',
  footerLine: '#eeeeee',
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return [24, 144, 255];
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

async function resolveLogoDataUrl(logoUrl?: string | null): Promise<string> {
  const candidates = [logoUrl, worklenzLogo as string].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (dataUrl.startsWith('data:image/')) return dataUrl;
    } catch {
      // try next candidate
    }
  }
  // Last resort: bundled asset URL (jsPDF can often load same-origin / imported URLs).
  return worklenzLogo as string;
}

const KPI_CARD_FILL: [number, number, number] = [244, 245, 246]; // #f9f9fa

function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  borderRgb: [number, number, number] = [217, 217, 217],
  fillRgb: [number, number, number] = KPI_CARD_FILL
): void {
  // Fill then stroke separately — some jsPDF builds skip fill on 'FD' roundedRect.
  doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
  doc.roundedRect(x, y, w, h, r, r, 'F');
  doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
  doc.setLineWidth(1.25);
  doc.roundedRect(x, y, w, h, r, r, 'S');
  doc.setLineWidth(0.5);
}

function drawHeader(
  doc: jsPDF,
  title: string,
  exportedOn: string,
  logoDataUrl: string
): number {
  // Match navbar logo: height 26, maxWidth 140 (NavbarLogo.tsx).
  const logoW = 140;
  const logoH = 26;
  try {
    const format = logoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
    doc.addImage(logoDataUrl, format, PAGE.marginX, PAGE.marginTop, logoW, logoH);
  } catch {
    // Continue without logo if the image cannot be embedded.
  }

  const titleX = PAGE.marginX + logoW + 14;
  doc.setTextColor(38, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, titleX, PAGE.marginTop + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Live export · ${exportedOn}`, titleX, PAGE.marginTop + 26);

  doc.setFillColor(24, 144, 255);
  doc.rect(PAGE.width - PAGE.marginX - 36, PAGE.marginTop + 4, 36, 3, 'F');
  doc.setFontSize(9);
  doc.text('Worklenz Analytics', PAGE.width - PAGE.marginX, PAGE.marginTop + 22, {
    align: 'right',
  });

  const dividerY = PAGE.marginTop + logoH + 12;
  doc.setDrawColor(240, 240, 240);
  doc.line(PAGE.marginX, dividerY, PAGE.width - PAGE.marginX, dividerY);
  return dividerY + 14;
}

function drawKpiCards(
  doc: jsPDF,
  kpis: AnalyticsPdfKpiTile[],
  startY: number
): number {
  if (!kpis.length) return startY;

  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(38, 38, 38);
  doc.text('Summary', PAGE.marginX, y);
  y += 14;

  const tiles = kpis.slice(0, 6);
  const gap = 12;
  const available = PAGE.width - PAGE.marginX * 2;
  const cardW = (available - gap * (tiles.length - 1)) / tiles.length;
  const cardH = 88;

  tiles.forEach((kpi, index) => {
    const x = PAGE.marginX + index * (cardW + gap);
    const tone = kpi.tone || TONES.primary;
    const [tr, tg, tb] = hexToRgb(tone);

    drawRoundedRect(doc, x, y, cardW, cardH, 8, [217, 217, 217], KPI_CARD_FILL);

    doc.setFillColor(tr, tg, tb);
    doc.circle(x + 14, y + 18, 4, 'F');

    doc.setTextColor(89, 89, 89);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(kpi.label, x + 24, y + 22, { maxWidth: cardW - 34 });

    doc.setTextColor(tr, tg, tb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(String(kpi.value), x + 14, y + 48, { maxWidth: cardW - 28 });

    if (kpi.sub) {
      doc.setTextColor(140, 140, 140);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(kpi.sub, x + 14, y + 66, { maxWidth: cardW - 28 });
    }
  });

  return y + cardH + 16;
}

function drawFooter(
  doc: jsPDF,
  title: string,
  exportedOn: string,
  footerNote?: string
): void {
  const y = PAGE.height - 22;
  const note =
    footerNote?.trim() || `Auto-generated by Worklenz · ${exportedOn} · ${title}`;

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(238, 238, 238);
    doc.line(PAGE.marginX, y - 10, PAGE.width - PAGE.marginX, y - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(note, PAGE.marginX, y, { maxWidth: PAGE.width - PAGE.marginX * 2 - 80 });
    doc.text(`Page ${page} of ${pageCount}`, PAGE.width - PAGE.marginX, y, {
      align: 'right',
    });
  }
}

function drawTable(doc: jsPDF, rows: string[][], startY: number): void {
  if (!rows.length) return;

  const header = rows[0] || [];
  const body = rows.slice(1, 101);
  const colCount = Math.max(header.length, 1);
  const tableWidth = PAGE.width - PAGE.marginX * 2;
  const colW = tableWidth / colCount;
  const rowH = 18;
  const headerRowH = 26;
  const bottomLimit = PAGE.height - PAGE.marginBottom;
  const borderRgb: [number, number, number] = [140, 140, 140];

  const ensureSpace = (y: number, needed: number): { y: number; newPage: boolean } => {
    if (y + needed <= bottomLimit) return { y, newPage: false };
    doc.addPage();
    return { y: PAGE.marginTop + 12, newPage: true };
  };

  const strokeCellGrid = (atY: number, cols: number, height: number) => {
    doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
    doc.setLineWidth(0.9);
    doc.rect(PAGE.marginX, atY, tableWidth, height, 'S');
    for (let i = 1; i < cols; i += 1) {
      const x = PAGE.marginX + i * colW;
      doc.line(x, atY, x, atY + height);
    }
  };

  let y = ensureSpace(startY, 40).y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(38, 38, 38);
  doc.text('Table', PAGE.marginX, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`Report data (${body.length} row${body.length === 1 ? '' : 's'})`, PAGE.marginX, y);
  y += 10;

  /** Column header always drawn above data rows (and again after each page break). */
  const drawHeaderRow = (atY: number): number => {
    doc.setFillColor(240, 241, 243);
    doc.rect(PAGE.marginX, atY, tableWidth, headerRowH, 'F');
    strokeCellGrid(atY, colCount, headerRowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(38, 38, 38);
    header.forEach((cell, i) => {
      doc.text(String(cell ?? ''), PAGE.marginX + i * colW + 4, atY + 16, {
        maxWidth: colW - 8,
      });
    });
    return atY + headerRowH;
  };

  y = ensureSpace(y, headerRowH + 4).y;
  y = drawHeaderRow(y);

  body.forEach(row => {
    const space = ensureSpace(y, rowH);
    y = space.y;
    if (space.newPage) {
      y = drawHeaderRow(y);
    }
    doc.setFillColor(255, 255, 255);
    doc.rect(PAGE.marginX, y, tableWidth, rowH, 'F');
    strokeCellGrid(y, colCount, rowH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(38, 38, 38);
    header.forEach((_, i) => {
      doc.text(String(row[i] ?? ''), PAGE.marginX + i * colW + 4, y + 12, {
        maxWidth: colW - 8,
      });
    });
    y += rowH;
  });
}

/** Prefer the active team's organization logo when present in Redux teams list. */
export function resolveAnalyticsPdfLogoUrl(
  teams: Array<{ id?: string; logo_url?: string | null }> | undefined,
  teamId?: string | null
): string | null {
  if (!teamId || !teams?.length) return null;
  return teams.find(team => team.id === teamId)?.logo_url ?? null;
}

/**
 * Build a landscape branded analytics PDF
 * (logo, KPI cards, chart, data table, footer + page numbers).
 */
export async function downloadAnalyticsBrandedPdf(
  options: AnalyticsBrandedPdfOptions
): Promise<void> {
  const exportedOn = options.exportedOn || new Date().toISOString().slice(0, 10);
  const logoDataUrl = await resolveLogoDataUrl(options.logoUrl);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  let cursorY = drawHeader(doc, options.title, exportedOn, logoDataUrl);
  cursorY = drawKpiCards(doc, options.kpis || [], cursorY);

  const primaryChart = options.chartPngDataUrl;
  const secondaryChart = options.secondaryChartPngDataUrl;
  if (primaryChart && secondaryChart) {
    // Match scheduled PDF: bar ~74%, donut ~24%, height 200, donut object-fit contain.
    const available = PAGE.width - PAGE.marginX * 2;
    const gap = available * 0.02;
    const barW = available * 0.74;
    const donutBoxW = available * 0.24;
    const chartH = Math.min(200, PAGE.height - cursorY - PAGE.marginBottom - 80);
    // Contain square donut (with legend) inside the right column — same as scheduled objectFit.
    const donutSide = Math.min(donutBoxW, chartH);
    const donutX = PAGE.marginX + barW + gap + (donutBoxW - donutSide) / 2;
    const donutY = cursorY + (chartH - donutSide) / 2;
    try {
      doc.addImage(primaryChart, 'PNG', PAGE.marginX, cursorY, barW, chartH);
      doc.addImage(secondaryChart, 'PNG', donutX, donutY, donutSide, donutSide);
      cursorY += chartH + 16;
    } catch {
      // Skip charts if embedding fails.
    }
  } else if (primaryChart) {
    const chartW = PAGE.width - PAGE.marginX * 2;
    const chartH = Math.min(220, PAGE.height - cursorY - PAGE.marginBottom - 80);
    try {
      doc.addImage(primaryChart, 'PNG', PAGE.marginX, cursorY, chartW, chartH);
      cursorY += chartH + 16;
    } catch {
      // Skip chart if embedding fails.
    }
  }

  if (options.tableRows?.length) {
    // Prefer a fresh page for the table so it is never hidden under the chart.
    if (cursorY > PAGE.height * 0.55) {
      doc.addPage();
      cursorY = drawHeader(doc, options.title, exportedOn, logoDataUrl);
    }
    drawTable(doc, options.tableRows, cursorY);
  }

  drawFooter(doc, options.title, exportedOn, options.footerNote);
  doc.save(options.filename);
}
