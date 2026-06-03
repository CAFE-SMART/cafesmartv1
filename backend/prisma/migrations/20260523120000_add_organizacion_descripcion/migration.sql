-- Migration: add_organizacion_descripcion
-- Purpose: Add optional descripcion column to organizacion for login/session payloads

ALTER TABLE "organizacion"
ADD COLUMN IF NOT EXISTS "descripcion" TEXT;
