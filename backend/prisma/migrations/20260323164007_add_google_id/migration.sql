/*
  Warnings:

  - A unique constraint covering the columns `[google_id]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "google_id" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "usuario_google_id_key" ON "usuario"("google_id");
