-- ============================================================
-- Migration: add_performance_indexes
-- Purpose: Optimize slow queries identified in Prisma logs
-- ============================================================

-- Sublote: optimize inventory queries and lote relations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sublote_tipoCafeId ON sublote(id_tipo_cafe);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sublote_calidadId ON sublote(id_calidad);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sublote_compraId ON sublote(id_compra);

-- Venta: optimize customer and seller lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_venta_clienteId ON venta(id_cliente);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_venta_creadoPor ON venta(id_usuario);

-- VentaDetalle: optimize frequent joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_venta_detalle_deletedAt ON venta_detalle(deleted_at);

-- Compra: optimize producer lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compra_productorId ON compra(id_productor);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compra_usuarioId ON compra(id_usuario);

-- GastoSublote: ensure FK indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gasto_sublote_gastoOperativoId ON gasto_sublote(id_gasto);

-- GastoOperativo: composite index for common filter patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gasto_op_deleted_organizacion ON gasto_operativo(deleted_at, id_organizacion);

-- Productor: optimize organizacion lookups for counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productor_organizacionId ON productor(id_organizacion);

-- User: optimize organizacion lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_organizacionId ON usuario(id_organizacion);

-- Cliente: optimize organizacion lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cliente_organizacionId ON cliente(id_organizacion);
