# Cálculo Financiero por Sublote — costoTotal Persistido

## Contexto

Los lotes son **agrupaciones visuales sin significado financiero**. El sublote es la unidad real de costo, trazabilidad, inventario y cálculo de utilidad.

El refactoring introduce un campo persistido `costoTotal` que fluye correctamente a lo largo del ciclo de vida del sublote.

---

## Cambios Propuestos

### 1. Schema — Prisma

#### [MODIFY] [schema.prisma](backend/prisma/schema.prisma)

Agregar `costoTotal` al modelo `Sublote`:

```prisma
costoTotal  Decimal   @map("costo_total") @db.Decimal(12, 2)
```

Migración SQL backfill: `UPDATE sublote SET costo_total = peso_inicial * precio_kg`

---

### 2. Backend — Compras

#### [MODIFY] [procesar-compra.ts](backend/src/compras/procesar-compra.ts)

Agregar `costoTotal` al tipo `CompraProcesada.sublotes` y calcularlo en `procesarSublote()`:
```
costoTotal = pesoInicial × precioKg  (ONLY on initial purchase)
```

#### [MODIFY] [compras.service.ts](backend/src/compras/compras.service.ts)

En `construirSublotesData()`, pasar `costoTotal` al `createMany`.

---

### 3. Backend — Lotes Service (`calcularFinancieroSublote`)

#### [MODIFY] [lotes.service.ts](backend/src/lotes/lotes.service.ts)

> [!CAUTION]
> **REGLA ABSOLUTA**: Después de la compra inicial, NUNCA recalcular el costo usando `precioKg`. Siempre usar `costoTotal` persistido.

**Tipo `SubloteFinanciero`:**
```typescript
type SubloteFinanciero = {
  costoTotal: number;
  totalVentas: number;
  pesoVendido: number;
  totalGastos: number;
  mermaKg: number;
  mermaPorcentaje: number;
  mermaValor: number;
  utilidadNeta: number;
};
```

**Fórmulas de `calcularFinancieroSublote()`:**

| Campo | Fórmula | Nota |
|---|---|---|
| `costoTotal` | Campo persistido | NUNCA derivar de `precioKg` |
| `pesoVendido` | `Σ detallesVenta.pesoVendido` | |
| `totalVentas` | `Σ detallesVenta.subtotal` | |
| `mermaKg` | `Math.max(0, pesoInicial − pesoActual − pesoVendido)` | Nunca negativo |
| `costoPorKg` | `costoTotal / (pesoInicial − pesoVendido)` | Costo por kg del inventario efectivo |
| `mermaPorcentaje` | `(mermaKg / pesoInicial) × 100` | |
| `mermaValor` | `mermaKg × costoPorKg` | Usa costo mejorado |
| `totalGastos` | `Σ gastoDistribuido` | Ver distribución abajo |
| `utilidadNeta` | `totalVentas − costoTotal − totalGastos − mermaValor` | |

**Distribución de gastos:**

```
pesoBase = pesoActual + pesoVendido

gastoSublote = (pesoBase / Σ pesoBase de sublotes vinculados) × montoGasto
```

> [!NOTE]
> Se usa `pesoBase = pesoActual + pesoVendido` como base de distribución porque refleja el peso que realmente participó del gasto (inventario actual + lo ya vendido), excluyendo la merma.

**Incluir relaciones Prisma en `findSublotesByLote`:**
- `detallesVenta` (where: `deletedAt: null`) → `pesoVendido`, `subtotal`
- `gastosOperativos → gastoOperativo → sublotes → sublote` → para calcular el peso total vinculado y distribuir proporcionalmente

**Resumen financiero del lote:** Suma de los financieros de todos los sublotes (solo visual).

---

### 4. Frontend

#### [MODIFY] [lotesService.ts](frontend/src/services/lotesService.ts)

Agregar campos financieros a `SubloteDetalle`.

#### [MODIFY] [Sublotes.tsx](frontend/src/pages/Sublotes.tsx)

Sección financiera por sublote + resumen del lote en la cabecera.

---

## Restricciones

| Restricción | Estado |
|---|---|
| No financieros en lotes | ✅ |
| No romper endpoints | ✅ Campos nuevos en respuesta existente |
| Compatibilidad datos existentes | ✅ Migración backfill |
| Cálculos modulares | ✅ `calcularFinancieroSublote()` puro |
| NUNCA usar precioKg post-compra | ✅ Explícito en implementación |

## Verificación

1. Migración Prisma + verificar backfill de datos existentes
2. Crear compra → `costoTotal = pesoInicial × precioKg`
3. Registrar gasto asociado → verificar distribución por peso
4. Venta parcial → verificar utilidad, merma, desglose
5. Build backend sin errores
