# Prueba de escritorio: compras y ventas

Fecha: 2026-05-02

## Objetivo

Validar de forma manual y trazable el flujo de compras y ventas, incluyendo impactos en inventario, capacidad de bodega y utilidad bruta.

## Supuestos iniciales

- Capacidad de bodega configurada: 1,000 kg.
- Inventario inicial: 200 kg.
- El umbral de alerta de bodega se activa al 80% de ocupación.
- Moneda de trabajo: COP.

## Casos de prueba

### Caso 1: Registro de compra válida sin alertas

Entradas:

- Fecha: 2026-05-02
- Productor: Finca El Roble
- Tipo: Pergamino seco
- Kilos: 300 kg
- Precio/kg: $9,000

Cálculo esperado:

| Concepto | Cálculo | Resultado |
| --- | ---: | ---: |
| Total compra | 300 x 9,000 | $2,700,000 |
| Nuevo inventario | 200 + 300 | 500 kg |
| Ocupación bodega | 500 / 1,000 | 50% |

Resultado esperado: compra aceptada sin warning.

### Caso 2: Compra que llega al umbral de alerta

Entradas:

- Inventario antes del movimiento: 500 kg.
- Kilos compra: 300 kg.

Cálculo esperado:

| Concepto | Cálculo | Resultado |
| --- | ---: | ---: |
| Nuevo inventario | 500 + 300 | 800 kg |
| Ocupación bodega | 800 / 1,000 | 80% |

Resultado esperado: compra aceptada con warning visible de capacidad al 80%.

### Caso 3: Compra que excede la capacidad

Entradas:

- Inventario antes del movimiento: 800 kg.
- Kilos compra: 250 kg.

Cálculo esperado:

| Concepto | Cálculo | Resultado |
| --- | ---: | ---: |
| Nuevo inventario teórico | 800 + 250 | 1,050 kg |
| Exceso | 1,050 - 1,000 | 50 kg |

Resultado esperado: compra bloqueada o rechazada por exceso de capacidad.

### Caso 4: Venta válida con inventario suficiente

Entradas:

- Inventario antes de venta: 800 kg.
- Cliente: Café Export S.A.S.
- Kilos venta: 180 kg.
- Precio venta/kg: $13,500.
- Costo promedio/kg inventario: $9,200.

Cálculo esperado:

| Concepto | Cálculo | Resultado |
| --- | ---: | ---: |
| Ingreso venta | 180 x 13,500 | $2,430,000 |
| Costo salida | 180 x 9,200 | $1,656,000 |
| Utilidad bruta | 2,430,000 - 1,656,000 | $774,000 |
| Inventario final | 800 - 180 | 620 kg |

Resultado esperado: venta aprobada, inventario descontado y utilidad positiva reflejada.

### Caso 5: Venta inválida por inventario insuficiente

Entradas:

- Inventario antes de venta: 620 kg.
- Kilos venta: 700 kg.

Cálculo esperado:

| Concepto | Cálculo | Resultado |
| --- | ---: | ---: |
| Validación de stock | 700 > 620 | Stock insuficiente |
| Inventario final esperado | Sin cambios | 620 kg |

Resultado esperado: venta rechazada por stock insuficiente y sin alterar inventario.

## Checklist de validación UI/API

- [ ] El formulario de compra calcula y muestra el total automáticamente.
- [ ] La compra al 80% muestra un warning visible.
- [ ] La compra que excede capacidad devuelve un error legible.
- [ ] La venta descuenta inventario inmediatamente.
- [ ] La venta sobre stock insuficiente no altera inventario.
- [ ] El módulo financiero refleja ingreso, costo y utilidad de venta.

## Evidencia automatizada relacionada

En backend existe una suite para capacidad de compra en `backend/src/compras/procesar-compra.spec.ts`. Esta suite valida:

- comportamiento debajo del 80%;
- alerta al 80%;
- bloqueo por exceso;
- casos borde;
- manejo de decimales;
- integración con `procesarCompra`.

Comando ejecutado:

```bash
pnpm -C backend test -- compras ventas
```

Resultado obtenido:

```text
PASS src/compras/procesar-compra.spec.ts
Test Suites: 1 passed, 1 total
Tests: 20 passed, 20 total
Ran all test suites matching /compras|ventas/i.
```

Nota: el patrón `compras ventas` ejecutó la suite existente de compras. Al momento de esta prueba no se encontró una suite `.spec.ts` específica de ventas; los casos de venta quedan cubiertos por esta prueba de escritorio y por la lógica de stock en `backend/src/ventas/procesar-venta.ts`.

## Resultado esperado del ciclo

La prueba se considera aprobada cuando:

- los cálculos manuales coinciden con la UI y la API;
- los warnings de capacidad aparecen en el punto correcto;
- los bloqueos no modifican inventario;
- las ventas descuentan el inventario correcto;
- la utilidad bruta se refleja con los valores esperados.

