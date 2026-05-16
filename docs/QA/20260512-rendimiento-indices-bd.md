# QA: Optimización de Rendimiento - Índices de Base de Datos

## Información General

| Campo | Valor |
|--------|-------|
| **Fecha de detección** | 12/05/2026 |
| **Fecha de implementación** | 12/05/2026 |
| **Tipo** | Mejora de Rendimiento / Optimización |
| **Severidad** | Media |
| **Estado** | Implementado - Pendiente Verificación |

## Problema Detectado

Se detectaron consultas SQL extremadamente lentas (800ms - 4.5 segundos) en los logs del backend de NestJS al usar Prisma:

```
[Nest] WARN [PrismaService] {"event":"prisma_slow_query","model":"User","action":"findUnique","durationMs":1369}
[Nest] WARN [PrismaService] {"event":"prisma_slow_query","model":"Compra","action":"count","durationMs":4572}
[Nest] WARN [PrismaService] {"event":"prisma_slow_query","model":"Venta","action":"count","durationMs":4580}
[Nest] WARN [PrismaService] {"event":"prisma_slow_query","model":"GastoOperativo","action":"count","durationMs":4582}
```

### Causa Raíz

Falta de índices en **foreign keys** y columnas frecuentemente consultadas, causando **full table scans** en cada consulta.

## Impacto

| Área Afectada | Síntoma |
|---------------|---------|
| Dashboard | Carga demorada al obtener estadísticas y contadores |
| Compras | Listado lento y conteos de proveedores |
| Ventas | Retraso al cargar historial y detalles |
| Productores | Contadores de organizaciones lentos |
| Inventario | Movimientos de inventario con consultas pesadas |
| Experiencia de usuario | Percepción de lentitud general del sistema |

## Solución Implementada

### Índices Creados (13 total)

| # | Tabla | Índice | Columna(s) | Propósito |
|---|-------|--------|------------|-----------|
| 1 | sublote | idx_sublote_tipoCafeId | id_tipo_cafe | Consultas por tipo de café |
| 2 | sublote | idx_sublote_calidadId | id_calidad | Consultas por calidad |
| 3 | sublote | idx_sublote_compraId | id_compra | Relaciones con compras |
| 4 | venta | idx_venta_clienteId | id_cliente | Búsquedas por cliente |
| 5 | venta | idx_venta_creadoPor | id_usuario | Búsquedas por vendedor |
| 6 | venta_detalle | idx_venta_detalle_deletedAt | deleted_at | Filtrado de eliminados |
| 7 | compra | idx_compra_productorId | id_productor | Count por productor |
| 8 | compra | idx_compra_usuarioId | id_usuario | Relaciones con usuarios |
| 9 | gasto_sublote | idx_gasto_sublote_gastoOperativoId | id_gasto | Foreign key |
| 10 | gasto_operativo | idx_gasto_op_deleted_organizacion | deleted_at, id_organizacion | Filtros compuestos |
| 11 | productor | idx_productor_organizacionId | id_organizacion | Count por organización |
| 12 | usuario | idx_user_organizacionId | id_organizacion | Búsquedas por org |
| 13 | cliente | idx_cliente_organizacionId | id_organizacion | Búsquedas por org |

### Migración

- Archivo: `prisma/migrations/add_performance_indexes/migration.sql`
- Ubicación: `docs/QA/20260512-rendimiento-indices-bd.md` (este documento)

## Resultado Esperado

| Métrica | Antes | Después (esperado) |
|---------|-------|--------------------|
| Tiempo de respuesta promedio | 800ms - 4.5s | < 100ms |
| Full table scans | Frecuentes | Mínimos |
| Uso de CPU en BD | Alto | Reducido |
| Carga del Dashboard | 4-5 segundos | < 1 segundo |

## Prueba Sugerida

### Pasos para Verificar

1. **Reiniciar el backend** para limpiar caché de Prisma
2. **Limpiar los logs previos** del terminal del backend
3. **Navegar por las siguientes secciones** y observar tiempos:
   - Dashboard (carga inicial)
   - Lista de Compras
   - Lista de Ventas
   - Lista de Productores
   - Inventario

4. **Comparar** con los tiempos anteriores:
   - Activar consola de desarrollo del navegador (F12)
   - Observar la pestaña Network para tiempos de respuesta
   - Comparar con los logs del backend (buscar WARN con slow_query)

### Comando para monitorear

```bash
# En la terminal del backend
cd backend
pnpm dev
# Observar líneas con durationMs en los logs
```

### Criterio de Éxito

- [ ] Consultas lentas ( > 500ms) eliminadas o reducidas significativamente
- [ ] Dashboard carga en menos de 2 segundos
- [ ] Sin errores en consola del navegador
- [ ] Todos los listados cargan sin timeout

## Notas Adicionales

- Los índices fueron creados con `CREATE INDEX IF NOT EXISTS` para ser idempotentes
- La tabla `gasto_operativo` tenía un índice compuesto previo que se complementa con el nuevo
- Supabase (PostgreSQL) soporta todos estos índices sin проблемas de espacio
- Los índices beneficiarán especialmente a dispositivos móviles con conexión más lenta