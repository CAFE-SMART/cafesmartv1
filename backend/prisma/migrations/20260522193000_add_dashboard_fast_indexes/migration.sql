CREATE INDEX IF NOT EXISTS "productor_id_organizacion_deleted_at_idx"
ON "productor"("id_organizacion", "deleted_at");

CREATE INDEX IF NOT EXISTS "venta_id_organizacion_deleted_at_fecha_idx"
ON "venta"("id_organizacion", "deleted_at", "fecha");

CREATE INDEX IF NOT EXISTS "gasto_operativo_id_organizacion_deleted_at_fecha_gasto_idx"
ON "gasto_operativo"("id_organizacion", "deleted_at", "fecha_gasto");
