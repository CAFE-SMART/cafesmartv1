# Cafe Smart

Sistema web y movil para la gestion de compraventas y cooperativas de cafe. El proyecto esta organizado como un monorepo simple con dos aplicaciones separadas:

- `frontend/`: React + Vite + Capacitor
- `backend/`: NestJS + Prisma

En esta rama ya quedaron incorporados:

- Registro tradicional en backend
- Registro con Google en backend
- Soporte para usuarios con `password` nullable y `googleId`
- Rutas base del frontend (`/login` y `/register`)
- Configuracion de Vite compatible con ESM
- Proyecto Android con `appId` `com.cafesmart.app`

## Estructura del proyecto

```text
cafesmartv1/
|-- backend/
|   |-- prisma/
|   |-- src/
|   `-- package.json
|-- frontend/
|   |-- android/
|   |-- src/
|   `-- package.json
|-- docker-compose.yml
`-- README.md
```

## Requisitos

Instala esto antes de empezar:

- Node.js 22 o superior
- pnpm
- Docker Desktop
- Android Studio

Comandos sugeridos para verificar:

```bash
node -v
pnpm -v
docker -v
```

Si no tienes `pnpm`, instalalo asi:

```bash
npm install -g pnpm
```

## Clonar el repositorio

```bash
git clone https://github.com/CAFE-SMART/cafesmartv1.git
cd cafesmartv1
```

## Importante sobre dependencias

Este proyecto no usa dependencias en la raiz.

- Instala backend dentro de `backend/`
- Instala frontend dentro de `frontend/`

No ejecutes `pnpm install` en la carpeta raiz.

## Configurar variables de entorno del backend

Crea el archivo `backend/.env`.

Ejemplo:

```env
DATABASE_URL="postgresql://USUARIO:CLAVE@HOST:5432/postgres"
DIRECT_URL="postgresql://USUARIO:CLAVE@HOST:5432/postgres"
PORT=3000
```

Notas:

- `DATABASE_URL` es obligatoria para Prisma.
- `DIRECT_URL` tambien es requerida por `backend/prisma/schema.prisma`.
- Si usan Supabase, pidan estas credenciales al responsable del proyecto.

## Instalacion del backend

```bash
cd backend
pnpm install
pnpm prisma generate
```

Si luego llegan cambios en `prisma/schema.prisma`, vuelve a ejecutar:

```bash
pnpm prisma generate
```

## Ejecutar el backend

Modo desarrollo:

```bash
cd backend
pnpm start:dev
```

Build de verificacion:

```bash
cd backend
pnpm build
```

El backend corre por defecto en:

```text
http://localhost:3000
```

## Instalacion del frontend

```bash
cd frontend
pnpm install
```

## Ejecutar el frontend en web

```bash
cd frontend
pnpm dev
```

Build de verificacion:

```bash
cd frontend
pnpm build
```

El frontend en desarrollo normalmente queda en:

```text
http://localhost:5173
```

## Rutas disponibles en este momento

Actualmente el frontend ya tiene estas rutas base:

- `/login`
- `/register`

## Ejecutar en Android con Capacitor

Desde `frontend/`:

```bash
pnpm build
npx cap sync
npx cap open android
```

Notas:

- El `appId` actual es `com.cafesmart.app`.
- Cada vez que cambies algo del frontend y quieras verlo en Android, vuelve a correr `pnpm build` y `npx cap sync`.

## Levantar con Docker

Tambien puedes levantar los contenedores definidos actualmente:

```bash
docker-compose up --build -d
```

Servicios expuestos:

- Frontend: `http://localhost`
- Backend: `http://localhost:3000`

## Flujo recomendado para nuevos compañeros

1. Clonar el repositorio.
2. Crear `backend/.env` con las credenciales correctas.
3. Instalar backend con `pnpm install`.
4. Ejecutar `pnpm prisma generate` en backend.
5. Instalar frontend con `pnpm install`.
6. Levantar backend con `pnpm start:dev`.
7. Levantar frontend con `pnpm dev`.

## Comandos utiles

Backend:

```bash
cd backend
pnpm install
pnpm prisma generate
pnpm start:dev
pnpm build
```

Frontend:

```bash
cd frontend
pnpm install
pnpm dev
pnpm build
npx cap sync
npx cap open android
```

## Estado actual de la rama

Antes de hacer merge, esta rama ya corrige estos puntos:

- Tipado seguro para usuarios Google en backend
- Creacion de `googleId` sin colisiones triviales
- Test Android alineado con `com.cafesmart.app`
- `AppRoutes` movido dentro de `src/`
- Dependencia `react-router-dom` agregada en frontend
- Eliminacion de dependencias accidentales en la raiz del repo
