import { Prisma } from '@prisma/client';

export interface SublotePesable {
  id: string;
  pesoActual: Prisma.Decimal | number | string;
}

export interface VentaResumen {
  pesoVendido: number;
}

export interface GastoSubloteLink {
  gastoOperativoId: string;
  subloteId: string;
  gastoOperativo: { montoGasto: Prisma.Decimal | number };
}

export function calcularGastosPorSubloteHelper(
  gastosSublote: GastoSubloteLink[],
  sublotes: SublotePesable[],
  ventasPorSublote: Map<string, VentaResumen>,
): Map<string, number> {
  const pesoBasePorSublote = new Map<string, number>();

  for (const sublote of sublotes) {
    const venta = ventasPorSublote.get(sublote.id);
    pesoBasePorSublote.set(
      sublote.id,
      Number(sublote.pesoActual) + (venta?.pesoVendido ?? 0),
    );
  }

  const linksPorGasto = new Map<string, GastoSubloteLink[]>();

  for (const link of gastosSublote) {
    const current = linksPorGasto.get(link.gastoOperativoId) ?? [];
    current.push(link);
    linksPorGasto.set(link.gastoOperativoId, current);
  }

  const gastosPorSublote = new Map<string, number>();

  for (const links of linksPorGasto.values()) {
    const montoGasto = Number(links[0]?.gastoOperativo.montoGasto ?? 0);
    const pesoBaseTotal = links.reduce(
      (sum, link) => sum + (pesoBasePorSublote.get(link.subloteId) ?? 0),
      0,
    );

    for (const link of links) {
      const pesoBase = pesoBasePorSublote.get(link.subloteId) ?? 0;
      const gastoAsignado =
        pesoBaseTotal > 0
          ? (pesoBase / pesoBaseTotal) * montoGasto
          : montoGasto / links.length;

      gastosPorSublote.set(
        link.subloteId,
        (gastosPorSublote.get(link.subloteId) ?? 0) + gastoAsignado,
      );
    }
  }

  return gastosPorSublote;
}
