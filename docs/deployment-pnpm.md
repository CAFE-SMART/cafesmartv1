# Despliegue con pnpm

Cafe Smart usa pnpm Workspaces desde la raiz del repositorio. No uses npm, npm ci, npm run ni npx en instalacion, build, Prisma o despliegue.

## Version unica

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm --version
```

La version debe coincidir con `packageManager` en `package.json`.

## Instalacion limpia

```bash
pnpm install --frozen-lockfile
```

El unico lockfile valido es `pnpm-lock.yaml`.

## Backend en Render

Si Render usa la raiz del repositorio:

```bash
corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm install --frozen-lockfile
pnpm --dir backend prisma:generate
pnpm --dir backend prisma:migrate:deploy
pnpm --dir backend build
pnpm --dir backend start:prod
```

Si Render separa Build Command y Start Command, usa:

```bash
# Build Command
corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm install --frozen-lockfile && pnpm --dir backend prisma:generate && pnpm --dir backend prisma:migrate:deploy && pnpm --dir backend build

# Start Command
pnpm --dir backend start:prod
```

No uses `prisma migrate dev` en produccion.

## Frontend en Netlify

`netlify.toml` instala desde la raiz y publica `frontend/dist`:

```bash
corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm install --frozen-lockfile && pnpm --dir frontend build
```

## Prisma

```bash
pnpm --dir backend prisma:generate
pnpm --dir backend prisma:migrate:deploy
pnpm --dir backend prisma:studio
```

## Android Capacitor

```bash
pnpm --dir frontend build:android
pnpm --dir frontend exec cap sync android
pnpm --dir frontend exec cap open android
```