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
```

Frontend: crear frontend/.env (hay ejemplo en frontend/.env.example)

```env
VITE_API_URL="http://localhost:3000"
VITE_GOOGLE_CLIENT_ID="tu_google_client_id_web"
```

## Ejecutar

Backend dev:

```bash
cd backend
pnpm start:dev
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

## Flujo esperado

1. Registro exitoso crea usuario y organizacion.
2. Register/Login guardan token y user en sesion.
3. Si hasCompany es true, navega a /inventario.
4. Google login, si cuenta existe y esta vinculada, entra directo a /inventario.

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
