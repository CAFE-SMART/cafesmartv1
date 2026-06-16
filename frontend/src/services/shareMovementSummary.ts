import { Share } from '@capacitor/share';

type CompraShareData = {
  productor: string;
  totalKg: number;
  totalPagado: number;
  fecha: string;
};

type VentaShareData = {
  cliente: string;
  tipoCafe?: string;
  calidad?: string;
  totalKg: number;
  precioKg?: number;
  totalVenta: number;
  fecha: string;
};

type ShareMovementSummaryInput =
  | { type: 'compra'; data: CompraShareData }
  | { type: 'venta'; data: VentaShareData };

function formatCurrency(value: number) {
  return `$${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)}`;
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value) || 0)} kg`;
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

function buildCompraText(data: CompraShareData) {
  return [
    'Compra registrada en Café Smart',
    '',
    `Productor: ${data.productor || 'Productor no registrado'}`,
    `Total kg: ${formatKg(data.totalKg)}`,
    `Total pagado: ${formatCurrency(data.totalPagado)}`,
    `Fecha: ${formatShareDate(data.fecha)}`,
  ].join('\n');
}

function buildVentaText(data: VentaShareData) {
  const lines = [
    'Venta registrada en Café Smart',
    '',
    `Cliente: ${data.cliente || 'Cliente no registrado'}`,
  ];

  if (data.tipoCafe) lines.push(`Tipo de café: ${data.tipoCafe}`);
  if (data.calidad) lines.push(`Calidad: ${data.calidad}`);

  lines.push(`Total kg vendidos: ${formatKg(data.totalKg)}`);

  if (data.precioKg !== undefined) {
    lines.push(`Precio por kg: ${formatCurrency(data.precioKg)}`);
  }

  lines.push(`Total recibido: ${formatCurrency(data.totalVenta)}`);
  lines.push(`Fecha: ${formatShareDate(data.fecha)}`);

  return lines.join('\n');
}

function isShareCancellation(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? '');
  return /cancel|cancell|dismiss|abort/i.test(message);
}

export async function shareMovementSummary(input: ShareMovementSummaryInput) {
  const isCompra = input.type === 'compra';
  const title = isCompra
    ? 'Compra registrada en Café Smart'
    : 'Venta registrada en Café Smart';
  const text = isCompra
    ? buildCompraText(input.data)
    : buildVentaText(input.data);

  try {
    await Share.share({
      title,
      text,
      dialogTitle: isCompra
        ? 'Compartir resumen de compra'
        : 'Compartir resumen de venta',
    });
    return true;
  } catch (error) {
    console.warn(
      `[CafeSmart][share-${input.type}] cancelado o error`,
      error,
    );
    return isShareCancellation(error);
  }
}
