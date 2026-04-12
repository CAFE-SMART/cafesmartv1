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
|   |   |-- schema.prisma
|   |   `-- seed.ts
|   |-- src/
|   `-- package.json
|-- frontend/
|   |-- android/
|   |-- src/
|   `-- package.json
|-- pnpm-workspace.yaml
|-- package.json (root)
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

### Opción 1: pnpm Workspaces (Recomendado)

Instalar todo desde la raíz:

```bash
pnpm install
```

Levantar servicios desde la raíz:

```bash
pnpm dev:backend   # Inicia backend en modo dev
pnpm dev:frontend  # Inicia frontend en modo dev
pnpm seed          # Ejecuta el seeding de la base de datos
```

### Opción 2: Instalación Manual

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

### Supabase (Producción o Nube)

Si usas Supabase, la configuración en `backend/.env` debe usar su Session Pooler o conexión directa.

### PostgreSQL Local (Alternativa rápida)

Si prefieres desarrollar localmente sin depender de Supabase, puedes usar el servicio incluido en `docker-compose.yml`:

1. Levanta la DB: `docker-compose up -d db`
2. Configura tu `backend/.env`:
   ```env
   DATABASE_URL="postgresql://user_cafe:password_cafe@localhost:5432/cafe_smart_db"
   DIRECT_URL="postgresql://user_cafe:password_cafe@localhost:5432/cafe_smart_db"
   ```
3. Ejecuta migraciones y seed:
   ```bash
   pnpm --filter cafe-smart-backend prisma migrate dev
   pnpm seed
   ```

Nota:
- El frontend Android/web no debe conectarse directo a Postgres.
- La app habla con el backend.
- El backend es quien se conecta a la base de datos.

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

## Dependencias Clave Implementadas

En este ciclo de desarrollo se incluyeron las siguientes dependencias esenciales:

**Frontend**:
- `@react-oauth/google`: Permite renderizar y gestionar el flujo seguro del botón de "Iniciar sesión con Google".
- `lucide-react`: Librería ligera que nos provee los iconos modernos (ej. los escudos y las gráficas en el estado del sistema).
- `@capacitor/...`: Conjunto de herramientas para compilar y empaquetar el frontend web `React` nativamente hacia `Android` (APK).

**Backend**:
- `@nestjs/jwt` y `bcrypt`: Se usan para encriptar las contraseñas de manera segura y gestionar los tokens de sesión firmados.
- `google-auth-library`: Librería oficial de Google para el servidor, sirve para *desencriptar y validar* los tokens de seguridad de Google desde el lado del Backend (garantizando autenticación verídica).
- `@prisma/client`: Nuestro ORM para interactuar con la base de datos de PostgreSQL (Supabase) evitando escribir consultas de SQL a mano.

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
- Se consolido respuestas de auth en un solo helper de backend.
- Se alineo frontend al contrato nuevo y se limpiaron mapeos viejos.
- Se corrigio el estandar de nombres de NestJS (`user.services.ts` a `users.service.ts`).
- Se modernizo el diseno de Estado del Sistema a un CSS Grid mas compacto y profesional.

## Android (Capacitor)
```bash
cd frontend
pnpm build
npx cap sync android
npx cap open android
```

## Configuración completa 
Después de bajar cambios de Git o instalar librerías nuevas, TODOS deben hacer:

1. Preparar frontend
  ``` bash
cd frontend
pnpm install
pnpm build
```

2. Sincronizar con Capacitor
```bash
npx cap sync android
```

3. Abrir correctamente en Android Studio
 - NO abrir la raíz del proyecto: cafesmartv1
 - SI abrir: cafesmartv1/frontend/android

4. Sincronizar Gradle (PASO CRÍTICO)
 - Si ves errores: Ir a: File > Sync Project with Gradle Files
 - Si aparece error tipo desugar / optimize: En build.gradle (Module: app) agregar o verificar:
```bash
isCoreLibraryDesugaringEnabled = true
```

5. Ejecutar la app
 - Emulador: API 24 mínimo
 - Celular físico: activar depuración USB
 - Luego presionar ▶️ Run

## Preparar celular (Modo desarrollador)
 - Activar modo desarrollador
 - Ajustes
 - Acerca del teléfono
 - Número de compilación
 - Tocar 7 veces
 - Activar depuración USB
 - Ajustes
 - Opciones de desarrollador
 - Activar "Depuración USB"
 - Conectar al PC
 - Aceptar permisos
 - Conectar dispositivo con QR (Running Device)

Si no quieres usar cable USB, puedes conectar el celular por WiFi usando QR:

## Pasos en Android Studio

 a. Abrir Android Studio
 b. Ir a Device Manager
 c. Clic en Pair Devices Using Wi-Fi
 d. Seleccionar Pair using QR Code
 e. En el celular
 f. Activar Opciones de desarrollador
 g. Entrar en Depuración inalámbrica (Wireless Debugging)
 h. Pulsar Vincular dispositivo con código QR
 i. Escanear el código que muestra Android Studio
 
Resultado: El celular aparecerá como dispositivo disponible logrando ejecutarlo con ▶️ Run sin cable

## Notas importantes
El celular y el PC deben estar en la misma red WiFi mantener activa la depuración inalámbrica y si no aparece el dispositivo, volver a emparejar

## Flujo de trabajo correcto (MUY IMPORTANTE)

Cada vez que hagan cambios en el frontend:
```bash
pnpm build
npx cap copy android
```
Luego: Abrir Android Studio y ejecutar con ▶️ Run

## Problemas comunes

Problema	                       Solución

Web asset directory not found	   Ejecutar pnpm build
No se reflejan cambios	           pnpm build + npx cap copy android
Error Java	                       Usar Java 17
No detecta celular	               Activar depuración USB
Error Capacitor	                   npx cap sync android
