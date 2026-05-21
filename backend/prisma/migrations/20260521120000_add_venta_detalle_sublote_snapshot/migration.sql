ALTER TABLE "venta_detalle"
  ADD COLUMN IF NOT EXISTS "codigo_sublote" TEXT,
  ADD COLUMN IF NOT EXISTS "tipo_cafe" TEXT,
  ADD COLUMN IF NOT EXISTS "calidad" TEXT,
  ADD COLUMN IF NOT EXISTS "precio_compra_kg" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "fecha_ingreso_sublote" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "inventario_restante" DECIMAL(10, 2);
