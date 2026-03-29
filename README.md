# Cafe Smart

Sistema web y movil para gestion de cooperativas y compraventas de cafe.

Este repositorio contiene dos aplicaciones:

- frontend: React + Vite + Capacitor
- backend: NestJS + Prisma

## Estructura

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

- Node.js 22+
- pnpm
- Android Studio (si se prueba movil)

Verificar:

```bash
node -v
pnpm -v
```

## Instalacion

Backend:

```bash
cd backend
pnpm install
pnpm prisma generate
```

Frontend:

```bash
cd frontend
pnpm install
```

## Variables de entorno

Backend: crear backend/.env (hay ejemplo en backend/.env.example)

Variables minimas:

```env
DATABASE_URL="postgresql://USUARIO:CLAVE@HOST:5432/postgres"
DIRECT_URL="postgresql://USUARIO:CLAVE@HOST:5432/postgres"
JWT_SECRET="tu_secreto"
GOOGLE_CLIENT_ID="tu_google_client_id"
GOOGLE_CLIENT_IDS="id_web,id_android"
PRISMA_CONNECT_MAX_ATTEMPTS=5
PRISMA_CONNECT_RETRY_DELAY_MS=3000
```

Frontend: crear frontend/.env (hay ejemplo en frontend/.env.example)

```env
VITE_API_URL="http://localhost:3000"
VITE_GOOGLE_CLIENT_ID="tu_google_client_id_web"
```

Importante:

- `backend/.env` si afecta el arranque real del backend.
- `backend/.env.example` y `frontend/.env.example` son solo guia para el equipo.
- Si el backend muestra error Prisma `P1000`, normalmente la clave real de Supabase no fue reemplazada bien en `DATABASE_URL` y `DIRECT_URL`.
- Si el backend muestra error Prisma `P1001`, suele ser un problema de conectividad con Supabase. El backend ahora hace reintentos breves antes de fallar.

## Supabase para desarrollo local

Si tu red local no soporta IPv6, no conviene usar la conexion directa:

```env
postgresql://postgres:CLAVE@db.PROYECTO.supabase.co:5432/postgres
```

Para este backend NestJS persistente se recomienda usar el Session pooler de Supabase en puerto 5432:

```env
DATABASE_URL="postgresql://postgres.PROYECTO:CLAVE@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres.PROYECTO:CLAVE@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
```

La cadena exacta se copia desde:

- Supabase
- Proyecto
- Connect
- Session pooler

Nota:

- El frontend Android/web no debe conectarse directo a Postgres.
- La app habla con el backend.
- El backend es quien se conecta a Supabase.

## Ejecutar

Backend dev:

```bash
cd backend
pnpm start:dev
```

Backend prod:

```bash
cd backend
pnpm build
pnpm start:prod
```

Frontend dev:

```bash
cd frontend
pnpm dev
```

Build de verificacion:

```bash
cd backend && pnpm build
cd frontend && pnpm build
```

## Rutas frontend

- /login
- /register
- /crear-empresa
- /estado-sistema
- /inventario (protegida)

## Auth estandarizado (actual)

Se unifico el contrato para login, register, loginGoogle y registerGoogle.

Respuesta unica:

```json
{
	"message": "Login exitoso",
	"access_token": "...",
	"hasCompany": true,
	"user": {
		"id": 1,
		"email": "user@mail.com",
		"name": "Nombre Apellido"
	}
}
```

Errores de campo (ejemplo correo duplicado):

```json
{
	"message": "El correo ya esta registrado",
	"field": "email"
}
```

## Convencion de idioma en codigo

Se adopto mix inteligente:

- Tecnico en ingles: user, email, access_token, hasCompany
- Dominio negocio en espanol: correo, nombre, organizacion en persistencia
- Mensajes al usuario en espanol

Regla:

- Un endpoint, un contrato.
- Evitar mezclar shapes viejos y nuevos.

## Persistencia de sesion

- Se usa @capacitor/preferences (no localStorage como fuente principal).
- Claves de sesion centralizadas en frontend/src/storage/authStorage.ts.
- Se implemento auto logout por expiracion de JWT en frontend/src/context/UserContext.tsx.

## Estado de nube y base offline-first (actual)

Se agrego una primera capa visual para preparar el camino offline-first sin romper la arquitectura actual.

Que hace hoy:

- Muestra un badge de nube en la parte superior de Inventario y Estado del sistema.
- Verifica si el dispositivo tiene internet.
- Verifica si la API del backend responde.
- Muestra cuando login o registro estan sincronizando con la nube.
- Muestra cuando la operacion quedo confirmada por la API.

Estados visibles del badge:

- Sin internet
- Verificando nube
- Nube conectada
- Sincronizando
- Guardado en la nube
- Servidor no disponible
- Fallo de sincronizacion

Importante:

- Esto todavia no es offline-first completo.
- Aun no existe SQLite local ni cola de sincronizacion para lotes, ventas o inventario.
- Esta fase solo deja la base de conectividad y feedback visual lista para que el equipo siga construyendo.

Archivos agregados para esta capa:

- frontend/src/context/CloudStatusContext.tsx
- frontend/src/components/CloudStatusBadge.tsx
- frontend/src/services/cloudStatusEvents.ts

Archivos ajustados:

- frontend/src/services/authService.ts
- frontend/src/pages/SystemStatus.tsx
- frontend/src/pages/Inventario.tsx
- frontend/src/main.tsx

Por que se hizo asi:

- Para no cambiar dependencias compartidas del equipo.
- Para no fingir una sincronizacion offline que todavia no existe.
- Para dejar una base reutilizable sobre la que luego se pueda montar SQLite local y una cola real de sync.

Siguiente fase recomendada:

1. Crear base local SQLite en la app.
2. Guardar primero local.
3. Crear tabla de cola de sincronizacion.
4. Subir pendientes al backend cuando vuelva internet.
5. Mostrar cantidad de pendientes junto al badge de nube.

## Flujo esperado

1. Registro exitoso crea usuario y organizacion.
2. Register/Login guardan token y user en sesion.
3. Si hasCompany es true, navega a /inventario.
4. Google login, si cuenta existe y esta vinculada, entra directo a /inventario.
5. Si login/registro llegan al backend, el badge de nube puede mostrar "Guardado en la nube" o "Sesion validada con la nube".

## Android (Capacitor)

```bash
cd frontend
pnpm build
npx cap sync android
npx cap open android
```

Para emulador Android usar URL backend con 10.0.2.2 si aplica.

## Limpieza realizada para evitar confusion

- Se removio capa legacy de sesion en frontend (sessionPersistence).
- Se elimino contrato viejo de auth que devolvia estructuras distintas.
- Se consolidaron respuestas de auth en un solo helper de backend.
- Se alineo frontend al contrato nuevo y se limpiaron mapeos viejos.
