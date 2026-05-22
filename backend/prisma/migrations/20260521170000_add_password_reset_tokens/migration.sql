CREATE TABLE IF NOT EXISTS "password_reset_token" (
  "id_password_reset_token" TEXT NOT NULL,
  "id_usuario" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id_password_reset_token")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_token_hash_key"
  ON "password_reset_token"("token_hash");

CREATE INDEX IF NOT EXISTS "password_reset_token_id_usuario_used_at_revoked_at_expires_at_idx"
  ON "password_reset_token"("id_usuario", "used_at", "revoked_at", "expires_at");

ALTER TABLE "password_reset_token"
  ADD CONSTRAINT "password_reset_token_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario")
  ON DELETE RESTRICT ON UPDATE CASCADE;
