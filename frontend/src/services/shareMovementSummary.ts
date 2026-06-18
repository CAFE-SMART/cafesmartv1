import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';

export type ShareSummaryFormat = 'image' | 'pdf' | 'text';

type ReceiptItem = {
  tipoCafe: string;
  calidad: string;
  cantidadKg: number;
  precioKg: number;
  subtotal: number;
};

type CompraShareData = {
  productor: string;
  tipoCafe?: string;
  calidad?: string;
  totalKg: number;
  precioKg?: number;
  totalPagado: number;
  fecha: string;
  referencia?: string;
  items?: ReceiptItem[];
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
  items?: ReceiptItem[];
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
  items?: ReceiptItem[];
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
        ...(data.items && data.items.length > 1
          ? []
          : [
              { label: 'Tipo de café', value: safeText(data.tipoCafe, 'No especificado') },
              { label: 'Calidad', value: safeText(data.calidad, 'No especificada') },
            ]),
        { label: 'Cantidad', value: formatKg(data.totalKg) },
        ...(data.items && data.items.length > 1
          ? []
          : [{ label: 'Precio por kg', value: formatCurrency(data.precioKg ?? 0) }]),
        { label: 'Total pagado', value: formatCurrency(data.totalPagado), highlight: true },
        { label: 'Fecha', value: formatShareDate(data.fecha) },
        ...(data.referencia
          ? [{ label: 'Referencia del movimiento', value: data.referencia } satisfies ReceiptRow]
          : []),
      ],
      items: data.items,
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
      ...(data.items && data.items.length > 1
        ? []
        : [
            { label: 'Tipo de café', value: safeText(data.tipoCafe, 'No especificado') },
            { label: 'Calidad', value: safeText(data.calidad, 'No especificada') },
          ]),
      { label: 'Cantidad vendida', value: formatKg(data.totalKg) },
      ...(data.items && data.items.length > 1
        ? []
        : [{ label: 'Precio por kg', value: formatCurrency(data.precioKg ?? 0) }]),
      { label: 'Total de la venta', value: formatCurrency(data.totalVenta), highlight: true },
      { label: 'Fecha', value: formatShareDate(data.fecha) },
      ...(data.referencia
        ? [{ label: 'Referencia del movimiento', value: data.referencia } satisfies ReceiptRow]
        : []),
    ],
    items: data.items,
  };
}

function buildPlainText(receipt: ReceiptData) {
  return [
    receipt.textTitle,
    '',
    ...receipt.rows.map((row) => `${row.label}: ${row.value}`),
    ...(receipt.items && receipt.items.length > 1
      ? [
          '',
          'Detalle',
          ...receipt.items.map(
            (item) =>
              `${safeText(item.tipoCafe, 'Café')} ${safeText(item.calidad, '')} — ${formatKg(item.cantidadKg)} · ${formatCurrency(item.precioKg)}/kg · ${formatCurrency(item.subtotal)}`,
          ),
        ]
      : []),
    '',
    'Registro generado desde CaféSmart.',
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
  const detailRows = receipt.items && receipt.items.length > 1 ? receipt.items.length : 0;
  const height = 390 + receipt.rows.length * rowHeight + detailRows * 94;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No pudimos preparar el comprobante.');
  }

  ctx.fillStyle = '#f5f7fb';
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, 70, 70, width - 140, height - 140, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#dbe5f3';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#102d92';
  ctx.font = '800 48px Arial';
  ctx.fillText('CaféSmart', 120, 155);

  ctx.fillStyle = '#64748b';
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
      ctx.fillStyle = '#eef4ff';
      drawRoundedRect(ctx, 110, y - 38, width - 220, 66, 18);
      ctx.fill();
    }

    const isReference = row.label.includes('Referencia');
    ctx.fillStyle = isReference ? '#94a3b8' : '#64748b';
    ctx.font = isReference ? '700 21px Arial' : '700 25px Arial';
    ctx.fillText(row.label, 130, y);

    ctx.fillStyle = row.highlight ? '#102d92' : isReference ? '#64748b' : '#1f2933';
    ctx.font = row.highlight ? '900 36px Arial' : isReference ? '700 22px Arial' : '800 30px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(row.value, width - 130, y);
    ctx.textAlign = 'left';

    y += rowHeight;
  }

  if (receipt.items && receipt.items.length > 1) {
    y += 12;
    ctx.fillStyle = '#102d92';
    ctx.font = '800 26px Arial';
    ctx.fillText('Detalle del comprobante', 120, y);
    y += 48;

    for (const item of receipt.items) {
      drawRoundedRect(ctx, 110, y - 36, width - 220, 72, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();

      ctx.fillStyle = '#1f2933';
      ctx.font = '800 24px Arial';
      ctx.fillText(
        `${safeText(item.tipoCafe, 'Café')} ${safeText(item.calidad, '')}`.trim(),
        130,
        y - 6,
      );

      ctx.fillStyle = '#64748b';
      ctx.font = '700 22px Arial';
      ctx.fillText(
        `${formatKg(item.cantidadKg)} · ${formatCurrency(item.precioKg)}/kg`,
        130,
        y + 24,
      );

      ctx.fillStyle = '#102d92';
      ctx.font = '900 26px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency(item.subtotal), width - 130, y + 8);
      ctx.textAlign = 'left';
      y += 94;
    }
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '700 25px Arial';
  ctx.fillText('Registro generado desde CaféSmart.', 120, height - 115);

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
    text: 'Comprobante generado desde CaféSmart',
    url: uri,
    dialogTitle: 'Compartir comprobante',
  });
}

async function sharePdf(receipt: ReceiptData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 54;
  let y = 72;

  doc.setFillColor(245, 247, 251);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 48, pageWidth - margin * 2, 690, 18, 18, 'F');

  doc.setTextColor(16, 45, 146);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('CaféSmart', margin + 26, y);

  y += 32;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(15);
  doc.text(receipt.title, margin + 26, y);

  y += 48;
  for (const row of receipt.rows) {
    if (row.highlight) {
      doc.setFillColor(238, 244, 255);
      doc.roundedRect(margin + 20, y - 24, pageWidth - margin * 2 - 40, 42, 10, 10, 'F');
    }
    if (row.label.includes('Referencia')) {
      doc.setTextColor(148, 163, 184);
    } else {
      doc.setTextColor(100, 116, 139);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(row.label.includes('Referencia') ? 10 : 12);
    doc.text(row.label, margin + 28, y);

    doc.setTextColor(row.highlight ? 16 : 31, row.highlight ? 45 : 41, row.highlight ? 146 : 51);
    doc.setFontSize(row.highlight ? 17 : row.label.includes('Referencia') ? 11 : 14);
    doc.text(row.value, pageWidth - margin - 28, y, { align: 'right' });
    y += 48;
  }

  if (receipt.items && receipt.items.length > 1) {
    y += 10;
    doc.setTextColor(16, 45, 146);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Detalle del comprobante', margin + 28, y);
    y += 28;

    for (const item of receipt.items) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin + 20, y - 18, pageWidth - margin * 2 - 40, 48, 9, 9, 'F');
      doc.setTextColor(31, 41, 51);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(
        `${safeText(item.tipoCafe, 'Café')} ${safeText(item.calidad, '')}`.trim(),
        margin + 32,
        y,
      );
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(10);
      doc.text(
        `${formatKg(item.cantidadKg)} · ${formatCurrency(item.precioKg)}/kg`,
        margin + 32,
        y + 16,
      );
      doc.setTextColor(16, 45, 146);
      doc.setFontSize(11);
      doc.text(formatCurrency(item.subtotal), pageWidth - margin - 32, y + 8, {
        align: 'right',
      });
      y += 58;
    }
  }

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(12);
  doc.text('Registro generado desde CaféSmart.', margin + 26, 705);

  const base64 = doc.output('datauristring').split(',')[1] ?? '';
  const uri = await writeCacheFile(
    `comprobantes/${receipt.fileBaseName}.pdf`,
    base64,
  );

  await Share.share({
    title: receipt.title,
    text: 'Comprobante generado desde CaféSmart',
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
