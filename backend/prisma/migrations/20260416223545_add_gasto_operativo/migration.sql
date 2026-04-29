-- CreateEnum
CREATE TYPE "TipoOrganizacion" AS ENUM ('COOPERATIVA', 'COMPRAVENTA', 'OTRO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('COMPRA', 'VENTA', 'SECADO', 'MEZCLA');

-- CreateEnum
CREATE TYPE "TipoReferenciaInventario" AS ENUM ('COMPRA', 'VENTA', 'SECADO', 'MEZCLA');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('TRANSPORTE', 'COMIDA', 'SECADO', 'CARGUE', 'DESCARGUE', 'OTROS');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PAGADO', 'PENDIENTE');

-- CreateTable
CREATE TABLE "tipo_cafe" (
    "id_tipo_cafe" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipo_cafe_pkey" PRIMARY KEY ("id_tipo_cafe")
);

-- CreateTable
CREATE TABLE "calidad" (
    "id_calidad" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calidad_pkey" PRIMARY KEY ("id_calidad")
);

-- CreateTable
CREATE TABLE "organizacion" (
    "id_organizacion" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_tipo_organizacion" "TipoOrganizacion" NOT NULL,
    "otro_tipo_detalle" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacion_pkey" PRIMARY KEY ("id_organizacion")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id_cliente" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "device_id" TEXT,
    "local_id" TEXT,
    "sync_status" TEXT,
    "id_organizacion" TEXT NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT,
    "google_id" TEXT,
    "telefono" TEXT NOT NULL,
    "id_rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_organizacion" TEXT NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "compra" (
    "id_compra" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "total_compra" DECIMAL(12,2) NOT NULL,
    "device_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario" TEXT NOT NULL,
    "id_organizacion" TEXT NOT NULL,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id_compra")
);

-- CreateTable
CREATE TABLE "sublote" (
    "id_sublote" TEXT NOT NULL,
    "peso_inicial" DECIMAL(10,2) NOT NULL,
    "peso_actual" DECIMAL(10,2) NOT NULL,
    "precio_kg" DECIMAL(10,2) NOT NULL,
    "humedad" DECIMAL(5,2),
    "id_lote" TEXT,
    "device_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_compra" TEXT NOT NULL,
    "id_tipo_cafe" TEXT NOT NULL,
    "id_calidad" TEXT NOT NULL,

    CONSTRAINT "sublote_pkey" PRIMARY KEY ("id_sublote")
);

-- CreateTable
CREATE TABLE "venta" (
    "id_venta" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_venta" DECIMAL(12,2) NOT NULL,
    "device_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "sync_status" TEXT,
    "deleted_at" TIMESTAMP(3),
    "id_cliente" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_organizacion" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id_venta")
);

-- CreateTable
CREATE TABLE "venta_detalle" (
    "id_venta_detalle" TEXT NOT NULL,
    "id_venta" TEXT NOT NULL,
    "id_sublote" TEXT NOT NULL,
    "peso_vendido" DECIMAL(10,2) NOT NULL,
    "precio_kg" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "device_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "sync_status" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venta_detalle_pkey" PRIMARY KEY ("id_venta_detalle")
);

-- CreateTable
CREATE TABLE "lote" (
    "id_lote" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_organizacion" TEXT NOT NULL,
    "id_tipo_cafe" TEXT NOT NULL,
    "id_calidad" TEXT NOT NULL,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id_lote")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id_inventario" TEXT NOT NULL,
    "peso_total" DECIMAL(12,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id_organizacion" TEXT NOT NULL,
    "id_tipo_cafe" TEXT NOT NULL,
    "id_calidad" TEXT NOT NULL,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id_inventario")
);

-- CreateTable
CREATE TABLE "inventario_movimiento" (
    "id_inventario_movimiento" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "tipo_movimiento" "TipoMovimientoInventario" NOT NULL,
    "referencia_tipo" "TipoReferenciaInventario" NOT NULL,
    "referencia_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_organizacion" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "id_tipo_cafe" TEXT NOT NULL,
    "id_calidad" TEXT NOT NULL,
    "id_sublote" TEXT,

    CONSTRAINT "inventario_movimiento_pkey" PRIMARY KEY ("id_inventario_movimiento")
);

-- CreateTable
CREATE TABLE "parametro_organizacion" (
    "id_parametro" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "id_organizacion" TEXT NOT NULL,

    CONSTRAINT "parametro_organizacion_pkey" PRIMARY KEY ("id_parametro")
);

-- CreateTable
CREATE TABLE "parametro" (
    "id_parametro" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "parametro_pkey" PRIMARY KEY ("id_parametro")
);

-- CreateTable
CREATE TABLE "gasto_operativo" (
    "id_gasto" TEXT NOT NULL,
    "concepto_gasto" TEXT NOT NULL,
    "descripcion" TEXT,
    "monto_gasto" DECIMAL(12,2) NOT NULL,
    "fecha_gasto" TIMESTAMP(3) NOT NULL,
    "tipo_gasto" "TipoGasto" NOT NULL,
    "estado_pago" "EstadoPago" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "device_id" TEXT,
    "sync_status" TEXT,
    "local_id" TEXT,
    "created_by" TEXT,
    "id_organizacion" TEXT NOT NULL,

    CONSTRAINT "gasto_operativo_pkey" PRIMARY KEY ("id_gasto")
);

-- CreateTable
CREATE TABLE "gasto_sublote" (
    "id_gasto_sublote" TEXT NOT NULL,
    "id_gasto" TEXT NOT NULL,
    "id_sublote" TEXT NOT NULL,

    CONSTRAINT "gasto_sublote_pkey" PRIMARY KEY ("id_gasto_sublote")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_cafe_nombre_key" ON "tipo_cafe"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "calidad_nombre_key" ON "calidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_google_id_key" ON "usuario"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "compra_device_id_local_id_key" ON "compra"("device_id", "local_id");

-- CreateIndex
CREATE UNIQUE INDEX "sublote_device_id_local_id_key" ON "sublote"("device_id", "local_id");

-- CreateIndex
CREATE INDEX "venta_id_organizacion_fecha_idx" ON "venta"("id_organizacion", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "venta_device_id_local_id_key" ON "venta"("device_id", "local_id");

-- CreateIndex
CREATE INDEX "venta_detalle_id_venta_idx" ON "venta_detalle"("id_venta");

-- CreateIndex
CREATE INDEX "venta_detalle_id_sublote_idx" ON "venta_detalle"("id_sublote");

-- CreateIndex
CREATE UNIQUE INDEX "venta_detalle_device_id_local_id_key" ON "venta_detalle"("device_id", "local_id");

-- CreateIndex
CREATE UNIQUE INDEX "lote_id_organizacion_id_tipo_cafe_id_calidad_key" ON "lote"("id_organizacion", "id_tipo_cafe", "id_calidad");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_id_organizacion_id_tipo_cafe_id_calidad_key" ON "inventario"("id_organizacion", "id_tipo_cafe", "id_calidad");

-- CreateIndex
CREATE INDEX "inventario_movimiento_id_organizacion_created_at_idx" ON "inventario_movimiento"("id_organizacion", "created_at");

-- CreateIndex
CREATE INDEX "inventario_movimiento_id_organizacion_id_tipo_cafe_id_calid_idx" ON "inventario_movimiento"("id_organizacion", "id_tipo_cafe", "id_calidad", "created_at");

-- CreateIndex
CREATE INDEX "inventario_movimiento_referencia_id_idx" ON "inventario_movimiento"("referencia_id");

-- CreateIndex
CREATE INDEX "inventario_movimiento_id_organizacion_referencia_id_idx" ON "inventario_movimiento"("id_organizacion", "referencia_id");

-- CreateIndex
CREATE INDEX "inventario_movimiento_id_sublote_idx" ON "inventario_movimiento"("id_sublote");

-- CreateIndex
CREATE UNIQUE INDEX "parametro_organizacion_id_organizacion_nombre_key" ON "parametro_organizacion"("id_organizacion", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "parametro_nombre_key" ON "parametro"("nombre");

-- CreateIndex
CREATE INDEX "gasto_operativo_id_organizacion_fecha_gasto_idx" ON "gasto_operativo"("id_organizacion", "fecha_gasto");

-- CreateIndex
CREATE INDEX "gasto_operativo_id_organizacion_tipo_gasto_idx" ON "gasto_operativo"("id_organizacion", "tipo_gasto");

-- CreateIndex
CREATE UNIQUE INDEX "gasto_operativo_device_id_local_id_key" ON "gasto_operativo"("device_id", "local_id");

-- CreateIndex
CREATE INDEX "gasto_sublote_id_sublote_idx" ON "gasto_sublote"("id_sublote");

-- CreateIndex
CREATE UNIQUE INDEX "gasto_sublote_id_gasto_id_sublote_key" ON "gasto_sublote"("id_gasto", "id_sublote");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sublote" ADD CONSTRAINT "sublote_id_compra_fkey" FOREIGN KEY ("id_compra") REFERENCES "compra"("id_compra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sublote" ADD CONSTRAINT "sublote_id_tipo_cafe_fkey" FOREIGN KEY ("id_tipo_cafe") REFERENCES "tipo_cafe"("id_tipo_cafe") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sublote" ADD CONSTRAINT "sublote_id_calidad_fkey" FOREIGN KEY ("id_calidad") REFERENCES "calidad"("id_calidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sublote" ADD CONSTRAINT "sublote_id_lote_fkey" FOREIGN KEY ("id_lote") REFERENCES "lote"("id_lote") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_id_venta_fkey" FOREIGN KEY ("id_venta") REFERENCES "venta"("id_venta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_detalle" ADD CONSTRAINT "venta_detalle_id_sublote_fkey" FOREIGN KEY ("id_sublote") REFERENCES "sublote"("id_sublote") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_id_tipo_cafe_fkey" FOREIGN KEY ("id_tipo_cafe") REFERENCES "tipo_cafe"("id_tipo_cafe") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_id_calidad_fkey" FOREIGN KEY ("id_calidad") REFERENCES "calidad"("id_calidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_tipo_cafe_fkey" FOREIGN KEY ("id_tipo_cafe") REFERENCES "tipo_cafe"("id_tipo_cafe") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_calidad_fkey" FOREIGN KEY ("id_calidad") REFERENCES "calidad"("id_calidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimiento" ADD CONSTRAINT "inventario_movimiento_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimiento" ADD CONSTRAINT "inventario_movimiento_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimiento" ADD CONSTRAINT "inventario_movimiento_id_tipo_cafe_fkey" FOREIGN KEY ("id_tipo_cafe") REFERENCES "tipo_cafe"("id_tipo_cafe") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimiento" ADD CONSTRAINT "inventario_movimiento_id_calidad_fkey" FOREIGN KEY ("id_calidad") REFERENCES "calidad"("id_calidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimiento" ADD CONSTRAINT "inventario_movimiento_id_sublote_fkey" FOREIGN KEY ("id_sublote") REFERENCES "sublote"("id_sublote") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro_organizacion" ADD CONSTRAINT "parametro_organizacion_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto_operativo" ADD CONSTRAINT "gasto_operativo_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto_sublote" ADD CONSTRAINT "gasto_sublote_id_gasto_fkey" FOREIGN KEY ("id_gasto") REFERENCES "gasto_operativo"("id_gasto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto_sublote" ADD CONSTRAINT "gasto_sublote_id_sublote_fkey" FOREIGN KEY ("id_sublote") REFERENCES "sublote"("id_sublote") ON DELETE RESTRICT ON UPDATE CASCADE;
