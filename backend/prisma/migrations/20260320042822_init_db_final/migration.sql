-- CreateEnum
CREATE TYPE "TipoOrganizacion" AS ENUM ('COOPERATIVA', 'COMPRAVENTA', 'OTRO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'OPERADOR');

-- CreateTable
CREATE TABLE "organizacion" (
    "id_organizacion" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_tipo_organizacion" "TipoOrganizacion" NOT NULL,
    "otro_tipo_detalle" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacion_pkey" PRIMARY KEY ("id_organizacion")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "id_rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_organizacion" INTEGER NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_organizacion_fkey" FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion") ON DELETE RESTRICT ON UPDATE CASCADE;
