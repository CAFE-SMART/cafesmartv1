CREATE INDEX "compra_id_organizacion_deleted_at_fecha_idx"
ON "compra"("id_organizacion", "deleted_at", "fecha");

CREATE INDEX "sublote_id_compra_idx"
ON "sublote"("id_compra");

CREATE INDEX "sublote_id_tipo_cafe_id_calidad_deleted_at_idx"
ON "sublote"("id_tipo_cafe", "id_calidad", "deleted_at");

CREATE INDEX "sublote_id_lote_idx"
ON "sublote"("id_lote");

CREATE INDEX "venta_detalle_id_sublote_deleted_at_idx"
ON "venta_detalle"("id_sublote", "deleted_at");

CREATE INDEX "gasto_operativo_id_organizacion_deleted_at_idx"
ON "gasto_operativo"("id_organizacion", "deleted_at");
