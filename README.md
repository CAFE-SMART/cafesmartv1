# Café Smart

Café Smart es una plataforma web y móvil orientada a la digitalización y optimización de la gestión operativa y financiera en compraventas y cooperativas de café.

El sistema estructura la operación bajo un modelo de control y trazabilidad por sublotes, permitiendo un seguimiento preciso del café desde su adquisición hasta su comercialización. A través de este enfoque, automatiza el cálculo de merma, costos y utilidad neta, garantizando integridad de la información y soporte para la toma de decisiones basada en datos.

## Tecnologías principales

- Backend: NestJS, Prisma y PostgreSQL
- Base de datos en la nube: Supabase
- Frontend web: React + Vite
- Aplicación móvil: Capacitor + Android Studio
- Monorepo: pnpm Workspaces

## Estructura general del proyecto

```text
cafesmartv1/
|-- backend/              API, lógica de negocio, Prisma y módulos del sistema
|-- frontend/             Aplicación web, app móvil con Capacitor y recursos Android
|-- docker-compose.yml    Entorno local opcional con PostgreSQL y servicios del proyecto
|-- package.json          Scripts principales del monorepo
|-- pnpm-workspace.yaml   Configuración de workspaces
`-- README.md             Documentación principal
```

### Componentes principales

- `backend/`
  API REST en NestJS, autenticación, módulos de compras, ventas, usuarios, parámetros y acceso a base de datos con Prisma.
- `backend/prisma/`
  Esquema principal de datos y seeding.
- `frontend/`
  Interfaz web en React y empaquetado móvil con Capacitor.
- `frontend/src/`
  Páginas, módulos funcionales, servicios, hooks y componentes reutilizables.
- `frontend/android/`
  Proyecto Android generado por Capacitor para compilar y ejecutar la app móvil en Android Studio.

## Requisitos

- Node.js 22 o superior
- pnpm
- Android Studio, si vas a probar la app móvil
- Cuenta o proyecto en Supabase, si vas a trabajar con la base en la nube

Verifica tu entorno con:

```bash
node -v
pnpm -v
```

## Configuración de variables de entorno

### Backend

Crea `backend/.env` a partir de `backend/.env.example`.

Las conexiones actuales del backend ya fueron validadas con Prisma y sí funcionan para:

- conexión normal del backend
- `prisma db pull --print`
- `prisma db push`
- sincronización de esquema con Supabase

Uso esperado:

- `DATABASE_URL`: conexión que usa el backend en ejecución normal
- `DIRECT_URL`: conexión directa que usa Prisma para tareas de esquema e introspección

Configuración recomendada en Supabase:

- `DATABASE_URL` usando Session Pooler
- `DIRECT_URL` usando la conexión directa del proyecto

Ejemplo:

```env
DATABASE_URL="postgresql://postgres.ielltlinimqcnwlkvrbs:TU_PASSWORD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:TU_PASSWORD@db.ielltlinimqcnwlkvrbs.supabase.co:5432/postgres?sslmode=require"
JWT_SECRET="cambia-esto-por-un-secreto-largo"
GOOGLE_CLIENT_ID="TU_CLIENT_ID_WEB.apps.googleusercontent.com"
GOOGLE_CLIENT_IDS="TU_CLIENT_ID_WEB.apps.googleusercontent.com,TU_CLIENT_ID_ANDROID.apps.googleusercontent.com"
PRISMA_CONNECT_MAX_ATTEMPTS=5
PRISMA_CONNECT_RETRY_DELAY_MS=3000
```

Notas importantes:

- Solo debes reemplazar `TU_PASSWORD` y los valores sensibles como `JWT_SECRET` y los Client ID de Google.
- Prisma CLI necesita que `DIRECT_URL` esté bien configurada cuando hagas `db pull`, `db push` o migraciones.

### Frontend

Crea `frontend/.env` a partir de `frontend/.env.example`.

Variables principales:

```env
VITE_API_URL="http://localhost:3000"
VITE_GOOGLE_CLIENT_ID="TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com"
```

Notas importantes:

- El frontend no se conecta directamente a PostgreSQL ni a Supabase.
- El frontend siempre consume el backend.
- Si cambias `VITE_API_URL`, debes volver a ejecutar `pnpm build` antes de sincronizar con Android.

## Ejecución local del proyecto

### Opción recomendada: desde la raíz con pnpm Workspaces

Instala dependencias:

```bash
pnpm install
```

Levanta backend y frontend en desarrollo:

```bash
pnpm dev:backend
pnpm dev:frontend
```

Ejecuta el seed del backend:

```bash
pnpm seed
```

### Ejecución manual por aplicación

Backend en desarrollo:

```bash
cd backend
pnpm install
pnpm start:dev
```

Backend en producción:

```bash
cd backend
pnpm build
pnpm start:prod
```

Frontend en desarrollo:

```bash
cd frontend
pnpm install
pnpm dev
```

Compilación de verificación:

```bash
cd backend
pnpm build

cd ../frontend
pnpm build
```

### Opción local con Docker

Si quieres levantar el stack localmente con Docker:

```bash
pnpm docker:up
```

Para apagarlo:

```bash
pnpm docker:down
```

Si solo quieres usar la base de datos local:

```bash
docker-compose up -d db
```

En ese caso, ajusta `backend/.env` para apuntar a tu PostgreSQL local.

## Ejecución en Android Studio

Esta es la forma recomendada para probar la app móvil Android usando Capacitor.

### 1. Prepara Android Studio

- Instala Android Studio.
- Abre el `SDK Manager` y asegúrate de tener instalado el SDK de Android.
- Crea un emulador desde el `Device Manager`, o conecta un dispositivo físico con depuración USB habilitada.

### 2. Configura el frontend

Antes de compilar la app móvil, revisa `frontend/.env`.

Ejemplos de `VITE_API_URL` según el entorno:

- Web local:
  `VITE_API_URL="http://localhost:3000"`
- Emulador Android:
  `VITE_API_URL="http://10.0.2.2:3000"`
- Dispositivo físico en la misma red:
  `VITE_API_URL="http://TU_IP_LOCAL:3000"`
- Backend desplegado:
  `VITE_API_URL="https://tu-backend.com"`

### 3. Construye la app web que usará Capacitor

Desde `frontend/`:

```bash
pnpm build
```

Este paso genera la carpeta `dist/`, que es la versión web que luego se copia al proyecto Android.

### 4. Sincroniza el proyecto Android

```bash
npx cap sync android
```

Este comando:

- copia los archivos de `dist/` al proyecto Android
- actualiza la integración de Capacitor
- refleja en Android los cambios recientes del frontend

Debes repetir `pnpm build` y luego `npx cap sync android` cada vez que cambies el frontend y quieras ver esos cambios en la app Android.

### 5. Abre Android Studio

```bash
npx cap open android
```

Esto abre el proyecto nativo Android generado dentro de `frontend/android/`.

### 6. Espera la sincronización de Gradle

Cuando Android Studio abra el proyecto:

- espera a que termine la sincronización de Gradle
- deja que descargue dependencias si es la primera vez
- revisa que no haya errores de SDK o de versión de Gradle

### 7. Ejecuta la app

- Selecciona el emulador o dispositivo físico en la barra superior de Android Studio.
- Pulsa el botón `Run`.
- Android Studio compilará el proyecto e instalará la app.

### 8. Cuándo repetir cada paso

- Si cambias código React, vistas, estilos o servicios del frontend:
  vuelve a ejecutar `pnpm build` y `npx cap sync android`.
- Si cambias configuración nativa Android:
  normalmente basta con abrir Android Studio y recompilar.

### Problemas comunes en Android

- La app abre pero no carga datos:
  revisa `VITE_API_URL` y confirma que el backend esté encendido.
- En el emulador no responde `localhost`:
  usa `10.0.2.2` en lugar de `localhost`.
- En dispositivo físico no conecta:
  usa la IP local de tu computador y asegúrate de que ambos estén en la misma red.
- Los cambios del frontend no aparecen:
  vuelve a ejecutar `pnpm build` y `npx cap sync android`.
- Android Studio tarda mucho o falla al abrir:
  espera la descarga inicial de Gradle y verifica que el SDK de Android esté instalado correctamente.

## Base de datos y Prisma

Comandos útiles desde `backend/`:

Generar Prisma Client:

```bash
pnpm exec prisma generate
```

Inspeccionar el estado actual de la base:

```bash
pnpm exec prisma db pull --print
```

Sincronizar el esquema con la base:

```bash
pnpm exec prisma db push
```

Seed de la base:

```bash
pnpm exec prisma db seed
```

Notas:

- Usa `DIRECT_URL` para tareas de Prisma relacionadas con esquema.
- Usa `DATABASE_URL` para la operación normal del backend.
- El modelo actual del sistema trabaja con trazabilidad por sublotes.
- El módulo de ventas descuenta inventario desde `Sublote` y registra movimientos para mantener trazabilidad.

## Problemas comunes

- Error Prisma `P1000`:
  normalmente la contraseña o la URL están mal escritas en `DATABASE_URL` o `DIRECT_URL`.
- Error Prisma `P1001`:
  suele indicar problema de conectividad con Supabase o con PostgreSQL.
- Prisma intenta borrar una columna existente:
  revisa primero la estructura real con `pnpm exec prisma db pull --print` antes de hacer `db push`.
- El backend no conecta al iniciar:
  confirma `DATABASE_URL`, `JWT_SECRET` y acceso a la red.
- Google OAuth falla:
  revisa los Client ID configurados en backend y frontend.
