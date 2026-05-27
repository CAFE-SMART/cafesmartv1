ALTER TABLE "productor"
ADD COLUMN IF NOT EXISTS "tipo_documento" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "productor_org_tipo_documento_unique_idx"
ON "productor"(
  "id_organizacion",
  (COALESCE("tipo_documento", 'CC')),
  (regexp_replace(lower("documento"), '[^a-z0-9]', '', 'g'))
)
WHERE "deleted_at" IS NULL
  AND "documento" IS NOT NULL;
