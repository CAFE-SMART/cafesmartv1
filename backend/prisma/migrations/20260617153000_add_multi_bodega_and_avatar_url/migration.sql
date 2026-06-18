CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "usuario"
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

CREATE TABLE IF NOT EXISTS "bodega" (
  "id_bodega" TEXT NOT NULL,
  "id_organizacion" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "ubicacion" TEXT,
  "capacidad_max_kg" DECIMAL(12, 2) NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "es_principal" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "bodega_pkey" PRIMARY KEY ("id_bodega")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bodega_id_organizacion_fkey'
  ) THEN
    ALTER TABLE "bodega"
      ADD CONSTRAINT "bodega_id_organizacion_fkey"
      FOREIGN KEY ("id_organizacion") REFERENCES "organizacion"("id_organizacion")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "bodega_id_organizacion_deleted_at_idx"
  ON "bodega"("id_organizacion", "deleted_at");

CREATE INDEX IF NOT EXISTS "bodega_id_organizacion_es_principal_idx"
  ON "bodega"("id_organizacion", "es_principal");

CREATE UNIQUE INDEX IF NOT EXISTS "bodega_principal_unica_idx"
  ON "bodega"("id_organizacion")
  WHERE "es_principal" = true AND "deleted_at" IS NULL;

INSERT INTO "bodega" (
  "id_bodega",
  "id_organizacion",
  "nombre",
  "ubicacion",
  "capacidad_max_kg",
  "activa",
  "es_principal",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  org."id_organizacion",
  COALESCE(nombre_param."valor", 'Bodega principal'),
  NULL,
  COALESCE(NULLIF(capacidad_param."valor", '')::DECIMAL(12, 2), 3000),
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizacion" org
LEFT JOIN "parametro_organizacion" nombre_param
  ON nombre_param."id_organizacion" = org."id_organizacion"
  AND nombre_param."nombre" = 'nombre_bodega'
LEFT JOIN "parametro_organizacion" capacidad_param
  ON capacidad_param."id_organizacion" = org."id_organizacion"
  AND capacidad_param."nombre" = 'capacidad_bodega'
WHERE NOT EXISTS (
  SELECT 1
  FROM "bodega" b
  WHERE b."id_organizacion" = org."id_organizacion"
    AND b."deleted_at" IS NULL
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'avatars_select_public'
    ) THEN
      CREATE POLICY "avatars_select_public"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'avatars');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'avatars_insert_own_folder'
    ) THEN
      CREATE POLICY "avatars_insert_own_folder"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'avatars_update_own_folder'
    ) THEN
      CREATE POLICY "avatars_update_own_folder"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    END IF;
  END IF;
END $$;
