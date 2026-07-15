ALTER TABLE "tipo_cafe"
  ADD COLUMN IF NOT EXISTS "id_organizacion" TEXT;

ALTER TABLE "calidad"
  ADD COLUMN IF NOT EXISTS "id_organizacion" TEXT;

ALTER TABLE "tipo_cafe"
  DROP CONSTRAINT IF EXISTS "tipo_cafe_nombre_key";

ALTER TABLE "calidad"
  DROP CONSTRAINT IF EXISTS "calidad_nombre_key";

CREATE UNIQUE INDEX IF NOT EXISTS "tipo_cafe_nombre_id_organizacion_key"
  ON "tipo_cafe"("nombre", "id_organizacion");

CREATE UNIQUE INDEX IF NOT EXISTS "calidad_nombre_id_organizacion_key"
  ON "calidad"("nombre", "id_organizacion");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tipo_cafe_id_organizacion_fkey'
  ) THEN
    ALTER TABLE "tipo_cafe"
      ADD CONSTRAINT "tipo_cafe_id_organizacion_fkey"
      FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calidad_id_organizacion_fkey'
  ) THEN
    ALTER TABLE "calidad"
      ADD CONSTRAINT "calidad_id_organizacion_fkey"
      FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;