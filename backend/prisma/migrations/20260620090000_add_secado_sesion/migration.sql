CREATE TYPE "EstadoSecadoProceso" AS ENUM (
  'PENDIENTE',
  'EN_ESPERA',
  'EN_PROCESO',
  'RESULTADO_REGISTRADO',
  'FINALIZADO',
  'CANCELADO',
  'ANULADO'
);

CREATE TABLE "secado_sesion" (
  "id_secado_sesion" TEXT NOT NULL,
  "id_organizacion" TEXT NOT NULL,
  "id_usuario" TEXT NOT NULL,
  "estado" "EstadoSecadoProceso" NOT NULL DEFAULT 'EN_PROCESO',
  "id_lote" TEXT,
  "id_tipo_cafe" TEXT NOT NULL,
  "id_calidad" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fecha_inicio" TIMESTAMP(3) NOT NULL,
  "fecha_finalizacion" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "secado_sesion_pkey" PRIMARY KEY ("id_secado_sesion")
);

CREATE INDEX "secado_sesion_id_organizacion_estado_fecha_inicio_idx"
  ON "secado_sesion"("id_organizacion", "estado", "fecha_inicio");

CREATE INDEX "secado_sesion_id_organizacion_id_lote_estado_idx"
  ON "secado_sesion"("id_organizacion", "id_lote", "estado");

ALTER TABLE "secado_sesion"
  ADD CONSTRAINT "secado_sesion_id_organizacion_fkey"
  FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "secado_sesion"
  ADD CONSTRAINT "secado_sesion_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario")
  ON DELETE RESTRICT ON UPDATE CASCADE;
