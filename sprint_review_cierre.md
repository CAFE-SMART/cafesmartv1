# Revision de cierre de sprint

Fecha: 2026-05-03

## Alcance revisado

- Registro de gastos operativos generales y asociados a sublotes.
- Listado de gastos generales y gastos por sublote con total acumulado.
- Calculo de utilidad, merma en kg, porcentaje y valor monetario.
- Dashboard financiero en `Resultado financiero`.
- Mensajes de error/exito, legibilidad movil y navegacion principal de los flujos revisados.

## Problemas encontrados y correcciones aplicadas

| Estado | Pantalla/Modulo | Problema encontrado | Correccion aplicada |
| --- | --- | --- | --- |
| Corregido | Registro de gastos | El frontend bloqueaba montos en 0, pero el backend aceptaba `montoGasto = 0`. | Se ajusto el DTO backend para exigir monto mayor a 0. |
| Corregido | Registro de gastos | El modal de error generico ocultaba la guia util y solo decia que no se pudo guardar. | El modal ahora muestra el mensaje guiado con que paso y que hacer. |
| Corregido | Registro de gastos | Despues de guardar, la accion secundaria enviaba a Inicio, aunque el flujo natural es revisar gastos. | Se cambio a `Ver gastos`, navegando a `/gastos`. |
| Corregido | Dashboard financiero | La tarjeta de compras usaba suma de movimientos recientes, no una metrica diaria consistente. | Se agrego `totalComprasHoy` al backend y se usa en el dashboard financiero. |
| Corregido | Dashboard financiero | La grafica mostraba dias sin movimiento en cero, lo que confundia la lectura. | Ahora solo muestra dias con compra, venta o gasto, hasta los ultimos 6 dias con actividad. |
| Corregido | Dashboard financiero | El eje de la grafica no explicaba que significaban los valores. | Se agregaron etiquetas: `Dinero (COP)` y `Fecha`, con valores reales de referencia. |
| Corregido | Ventas | Mensajes de cliente y tipo de venta eran genericos o caian en error general. | Se ajustaron a mensajes directos: que paso y que debe hacer el usuario. |
| Corregido | Ventas | Ajuste de peso hablaba de merma durante la venta. | Se cambio a ajuste de peso antes de vender, usando icono de balanza y barra de ajuste. |

## Criterios del sprint

| Criterio | Resultado |
| --- | --- |
| Registrar gasto con nombre, tipo, valor y fecha. | Cumple. Frontend valida campos y backend persiste con usuario/organizacion. |
| Asociar gasto a sublote o dejarlo general. | Cumple. `asociarASublotes` y `subloteIds` controlan la asociacion. |
| Consultar gastos de un sublote y total acumulado. | Cumple. `/gastos?subloteId=...` lista y suma gastos del sublote. |
| Guardar con campos vacios muestra mensajes especificos sin perder datos. | Cumple. Los datos permanecen en estado local y los errores guian al campo. |
| Calcular utilidad neta con compra, venta y gastos. | Cumple. Backend calcula costo vendido, gastos y utilidad por sublote. |
| Calcular merma en kg, porcentaje y valor. | Cumple. Backend calcula merma con peso inicial, actual y vendido. |
| Recalcular utilidad al registrar nuevo gasto. | Cumple. Los calculos se leen dinamicamente desde gastos/ventas actuales. |
| Dashboard muestra inventario disponible, utilidad acumulada y merma acumulada. | Cumple en `Resultado financiero`; `Inicio` mantiene resumen operativo. |
| Dashboard actualiza metricas tras compra, venta o gasto. | Cumple. Consulta backend actualizada; compras/ventas/gastos del dia y utilidad acumulada se recalculan. |
| Sin registros, indicadores en cero y mensaje orientador. | Cumple. Dashboard y listados muestran estados vacios orientadores. |

## Notas para QA

- Probar gasto general con concepto, monto, tipo, fecha y estado.
- Probar gasto asociado a uno o varios sublotes.
- Probar formulario de gastos con concepto vacio, monto vacio/cero, fecha vacia y sublotes sin seleccionar.
- Registrar compra, gasto y venta; luego validar `Resultado financiero`.
- En sublote, revisar `Ver gastos` y resultados financieros.
- En ventas, probar ajuste de peso antes de vender y confirmar que no se muestra lenguaje de merma al usuario.
