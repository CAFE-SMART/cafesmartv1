ALTER TABLE "cliente"
ADD COLUMN "documento" TEXT;

CREATE TABLE "productor" (
    "id_productor" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "telefono" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "device_id" TEXT,
    "local_id" TEXT,
    "sync_status" TEXT,
    "id_organizacion" TEXT NOT NULL,

    CONSTRAINT "productor_pkey" PRIMARY KEY ("id_productor")
);

ALTER TABLE "compra"
ADD COLUMN "id_productor" TEXT;

CREATE INDEX "productor_id_organizacion_deleted_at_idx"
ON "productor"("id_organizacion", "deleted_at");

CREATE INDEX "compra_id_productor_idx"
ON "compra"("id_productor");

ALTER TABLE "productor"
ADD CONSTRAINT "productor_id_organizacion_fkey"
FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compra"
ADD CONSTRAINT "compra_id_productor_fkey"
FOREIGN KEY ("id_productor") REFERENCES "productor"("id_productor")
ON DELETE SET NULL ON UPDATE CASCADE;
