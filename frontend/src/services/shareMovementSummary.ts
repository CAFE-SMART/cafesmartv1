import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';

export type ShareSummaryFormat = 'image' | 'pdf' | 'text';

type CompraShareData = {
  productor: string;
  tipoCafe?: string;
  calidad?: string;
  totalKg: number;
  precioKg?: number;
  totalPagado: number;
  fecha: string;
  referencia?: string;
};

type VentaShareData = {
  cliente: string;
  tipoCafe?: string;
  calidad?: string;
  totalKg: number;
  precioKg?: number;
  totalVenta: number;
  fecha: string;
  referencia?: string;
};

type ShareMovementSummaryInput =
  | { type: 'compra'; data: CompraShareData; format?: ShareSummaryFormat }
  | { type: 'venta'; data: VentaShareData; format?: ShareSummaryFormat };

type ReceiptRow = {
  label: string;
  value: string;
  highlight?: boolean;
};

type ReceiptData = {
  kind: 'compra' | 'venta';
  title: string;
  fileBaseName: string;
  textTitle: string;
  rows: ReceiptRow[];
};

function safeText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number) {
  return `$${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(safeNumber(value))} COP`;
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: safeNumber(value) % 1 === 0 ? 0 : 2,
  }).format(safeNumber(value))} kg`;
}

function formatShareDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || 'Sin fecha';

  return parsed.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getReceiptData(input: ShareMovementSummaryInput): ReceiptData {
  if (input.type === 'compra') {
    const data = input.data;
    return {
      kind: 'compra',
      title: 'Comprobante de compra',
      textTitle: 'Compra registrada en Café Smart',
      fileBaseName: 'comprobante-compra-cafesmart',
      rows: [
        { label: 'Productor', value: safeText(data.productor, 'Productor no registrado') },
        { label: 'Tipo de café', value: safeText(data.tipoCafe, 'No especificado') },
        { label: 'Calidad', value: safeText(data.calidad, 'No especificada') },
        { label: 'Cantidad', value: formatKg(data.totalKg) },
        { label: 'Precio por kg', value: formatCurrency(data.precioKg ?? 0) },
        { label: 'Total pagado', value: formatCurrency(data.totalPagado), highlight: true },
        { label: 'Fecha', value: formatShareDate(data.fecha) },
        ...(data.referencia
          ? [{ label: 'Referencia', value: data.referencia } satisfies ReceiptRow]
          : []),
      ],
    };
  }

  const data = input.data;
  return {
    kind: 'venta',
    title: 'Comprobante de venta',
    textTitle: 'Venta registrada en Café Smart',
    fileBaseName: 'comprobante-venta-cafesmart',
    rows: [
      { label: 'Cliente', value: safeText(data.cliente, 'Cliente General') },
      { label: 'Tipo de café', value: safeText(data.tipoCafe, 'No especificado') },
      { label: 'Calidad', value: safeText(data.calidad, 'No especificada') },
      { label: 'Cantidad vendida', value: formatKg(data.totalKg) },
      { label: 'Precio por kg', value: formatCurrency(data.precioKg ?? 0) },
      { label: 'Total de la venta', value: formatCurrency(data.totalVenta), highlight: true },
      { label: 'Fecha', value: formatShareDate(data.fecha) },
      ...(data.referencia
        ? [{ label: 'Referencia', value: data.referencia } satisfies ReceiptRow]
        : []),
    ],
  };
}

function buildPlainText(receipt: ReceiptData) {
  return [
    receipt.textTitle,
    '',
    ...receipt.rows.map((row) => `${row.label}: ${row.value}`),
    '',
    'Registro generado desde Café Smart.',
  ].join('\n');
}

function isShareCancellation(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? '');
  return /cancel|cancell|dismiss|abort/i.test(message);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function createReceiptImageBase64(receipt: ReceiptData) {
  const width = 1080;
  const rowHeight = 82;
  const height = 360 + receipt.rows.length * rowHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No pudimos preparar el comprobante.');
  }

  ctx.fillStyle = '#f6f7f3';
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, 70, 70, width - 140, height - 140, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#dbe3d1';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#25412f';
  ctx.font = '800 48px Arial';
  ctx.fillText('Café Smart', 120, 155);

  ctx.fillStyle = '#6f7d68';
  ctx.font = '700 27px Arial';
  ctx.fillText(receipt.title, 120, 198);

  ctx.fillStyle = receipt.kind === 'compra' ? '#e9f6ee' : '#eaf2ff';
  drawRoundedRect(ctx, width - 240, 115, 96, 96, 24);
  ctx.fill();
  ctx.fillStyle = receipt.kind === 'compra' ? '#187047' : '#1d4ed8';
  ctx.font = '800 46px Arial';
  ctx.fillText(receipt.kind === 'compra' ? 'C' : 'V', width - 205, 178);

  let y = 270;
  for (const row of receipt.rows) {
    if (row.highlight) {
      ctx.fillStyle = '#f4f8ed';
      drawRoundedRect(ctx, 110, y - 38, width - 220, 66, 18);
      ctx.fill();
    }

    ctx.fillStyle = '#66705f';
    ctx.font = '700 25px Arial';
    ctx.fillText(row.label, 130, y);

    ctx.fillStyle = row.highlight ? '#25412f' : '#1f2933';
    ctx.font = row.highlight ? '900 34px Arial' : '800 30px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(row.value, width - 130, y);
    ctx.textAlign = 'left';

    y += rowHeight;
  }

  ctx.fillStyle = '#6f7d68';
  ctx.font = '700 25px Arial';
  ctx.fillText('Registro generado desde Café Smart.', 120, height - 115);

  return canvas.toDataURL('image/png').split(',')[1] ?? '';
}

async function writeCacheFile(path: string, base64Data: string) {
  await Filesystem.writeFile({
    path,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });
  return uri;
}

async function sharePlainText(receipt: ReceiptData) {
  await Share.share({
    title: receipt.textTitle,
    text: buildPlainText(receipt),
    dialogTitle: 'Compartir comprobante',
  });
}

async function shareImage(receipt: ReceiptData) {
  const base64 = await createReceiptImageBase64(receipt);
  const uri = await writeCacheFile(
    `comprobantes/${receipt.fileBaseName}.png`,
    base64,
  );

  await Share.share({
    title: receipt.title,
    text: 'Comprobante generado desde Café Smart',
    url: uri,
    dialogTitle: 'Compartir comprobante',
  });
}

async function sharePdf(receipt: ReceiptData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 54;
  let y = 72;

  doc.setFillColor(246, 247, 243);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 48, pageWidth - margin * 2, 690, 18, 18, 'F');

  doc.setTextColor(37, 65, 47);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('Café Smart', margin + 26, y);

  y += 32;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(15);
  doc.text(receipt.title, margin + 26, y);

  y += 48;
  for (const row of receipt.rows) {
    if (row.highlight) {
      doc.setFillColor(244, 248, 237);
      doc.roundedRect(margin + 20, y - 24, pageWidth - margin * 2 - 40, 42, 10, 10, 'F');
    }
    doc.setTextColor(102, 112, 95);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(row.label, margin + 28, y);

    doc.setTextColor(31, 41, 51);
    doc.setFontSize(row.highlight ? 16 : 14);
    doc.text(row.value, pageWidth - margin - 28, y, { align: 'right' });
    y += 48;
  }

  doc.setTextColor(107, 125, 104);
  doc.setFontSize(12);
  doc.text('Registro generado desde Café Smart.', margin + 26, 705);

  const base64 = doc.output('datauristring').split(',')[1] ?? '';
  const uri = await writeCacheFile(
    `comprobantes/${receipt.fileBaseName}.pdf`,
    base64,
  );

  await Share.share({
    title: receipt.title,
    text: 'Comprobante generado desde Café Smart',
    url: uri,
    dialogTitle: 'Compartir comprobante',
  });
}

export async function shareMovementSummary(input: ShareMovementSummaryInput) {
  const receipt = getReceiptData(input);
  const format = input.format ?? 'image';

  try {
    if (format === 'pdf') {
      await sharePdf(receipt);
      return true;
    }

    if (format === 'text') {
      await sharePlainText(receipt);
      return true;
    }

    await shareImage(receipt);
    return true;
  } catch (error) {
    console.warn(
      `[CafeSmart][share-${input.type}] comprobante falló, usando texto`,
      error,
    );

    if (isShareCancellation(error)) return true;

    try {
      await sharePlainText(receipt);
      return true;
    } catch (fallbackError) {
      console.warn(
        `[CafeSmart][share-${input.type}] cancelado o error`,
        fallbackError,
      );
      return isShareCancellation(fallbackError);
    }
  }
}
