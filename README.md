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

Genera el cliente de Prisma (recomendado en instalaciones limpias):

```bash
pnpm --filter cafe-smart-backend exec prisma generate
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

## Instalación de emulador Android

Este proyecto puede ejecutarse en un emulador Android usando Android Studio. No necesitas un modelo específico: puedes crear cualquier dispositivo virtual tipo `Phone`. Pixel 5 es una buena opción de ejemplo porque es liviano y representa bien un celular estándar, pero también puedes usar Pixel 4, Pixel 6, Nexus u otro perfil disponible.

### Requisitos previos

Antes de crear el emulador, confirma que tienes:

- Android Studio instalado
- Android SDK instalado desde Android Studio
- Virtual Device Manager, incluido en Android Studio
- Espacio libre en disco para descargar una imagen de Android
- Virtualización activada en BIOS/UEFI si tu equipo lo requiere

### 1. Abrir el administrador de dispositivos

1. Abre Android Studio.
2. En la pantalla inicial selecciona `More Actions`.
3. Entra a `Virtual Device Manager`.

Si ya tienes un proyecto abierto, también puedes ir a:

```text
Tools -> Device Manager
```

### 2. Crear un dispositivo virtual

1. Haz clic en `Create Device`.
2. Selecciona una categoría. Para pruebas normales se recomienda `Phone`.
3. Elige un modelo. Ejemplos válidos:
   - `Pixel 5`
   - `Pixel 6`
   - `Pixel 7`
   - cualquier otro teléfono disponible
4. Haz clic en `Next`.

Recomendación: usa un teléfono de tamaño medio para validar bien la experiencia móvil. Pixel 5 sirve como referencia, pero no es obligatorio.

### 3. Seleccionar la imagen del sistema

1. Elige una versión de Android.
2. Recomendado: Android 12, API 31, o superior.
3. Si la imagen no está instalada, haz clic en `Download`.
4. Espera la descarga y acepta las licencias.
5. Haz clic en `Next`.

Para mejor rendimiento, usa una imagen `x86_64` cuando esté disponible.

### 4. Configurar el emulador

En la pantalla de configuración puedes ajustar:

- Nombre del AVD, por ejemplo `CafeSmart_Pixel_5` o `CafeSmart_Android_API_33`
- Orientación inicial: `Portrait` recomendada
- RAM y almacenamiento, si Android Studio permite editarlo
- Gráficos: deja la opción recomendada por Android Studio si no estás seguro

Luego haz clic en `Finish`.

### 5. Ejecutar el emulador

1. Vuelve al `Device Manager`.
2. Busca el dispositivo virtual creado.
3. Presiona el botón `Play`.
4. Espera a que Android inicie completamente antes de ejecutar la app.

El primer arranque puede tardar varios minutos. Los siguientes suelen ser más rápidos.

### 6. Ejecutar Café Smart en el emulador

Con el emulador encendido, puedes ejecutar la app desde terminal:

```bash
cd frontend
pnpm build:android
npx cap sync android
npx cap run android
```

También puedes hacerlo desde Android Studio:

1. Abre el proyecto Android con:

```bash
cd frontend
npx cap open android
```

2. Selecciona el emulador en la barra superior.
3. Presiona `Run`.

### Problemas comunes del emulador

#### El emulador no inicia

- Verifica que la virtualización esté activada en BIOS/UEFI.
- Reinicia Android Studio.
- Cierra otros emuladores abiertos.
- Desde `Device Manager`, prueba `Cold Boot Now`.
- Si sigue fallando, crea un emulador nuevo con otra imagen del sistema.

#### Error con archivos `.lock`

Si aparece un error relacionado con archivos `.lock`, por ejemplo:

```text
emu-last-feature-flags.protobuf.lock
```

Cierra Android Studio y todos los emuladores. Luego ejecuta en PowerShell:

```powershell
Remove-Item "$env:USERPROFILE\.android\*.lock" -Force
```

Después vuelve a abrir Android Studio e inicia el emulador.

#### El emulador está lento

- Usa una imagen `x86_64`.
- Cierra programas pesados en segundo plano.
- Reduce la RAM del dispositivo virtual si tu computador tiene poca memoria.
- Evita tener varios emuladores abiertos al mismo tiempo.
- Usa un modelo tipo `Phone` antes que `Tablet` para pruebas estándar.

#### La app abre pero no conecta con el backend

En emulador Android, `localhost` apunta al propio emulador, no a tu computador. Para consumir el backend local usa:

```env
VITE_API_URL="http://10.0.2.2:3000"
```

Luego vuelve a ejecutar:

```bash
cd frontend
pnpm build:android
npx cap sync android
```

### Recomendaciones

- Usa `Phone` para pruebas móviles estándar.
- Pixel 5 es opcional, no obligatorio.
- Mantén Android Studio y el SDK actualizados.
- Si un emulador se daña con frecuencia, es más rápido crear uno nuevo que intentar repararlo muchas veces.
- Para pruebas en celular real, conecta el dispositivo por USB y habilita la depuración USB.

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

## Ejecución Android desde terminal

Este flujo sirve para compilar, instalar y abrir la app Android sin usar el botón `Run` de Android Studio.

### 1. Enciende el backend

Desde la raíz del proyecto:

```bash
pnpm dev:backend
```

Deja esta terminal abierta.

### 2. Verifica que exista un emulador o dispositivo

En otra terminal:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices -l
```

Debe aparecer un dispositivo en estado `device`, por ejemplo:

```text
emulator-5554 device
```

Si PowerShell dice que `adb` no existe, usa siempre la ruta completa anterior. Eso pasa cuando Android SDK no está agregado al `PATH` de Windows.

Si no aparece ningún dispositivo, lista los emuladores instalados:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds
```

Luego arranca el emulador. Ejemplo:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd CafeSmart_Pixel_5
```

Espera a que Android termine de iniciar y vuelve a ejecutar:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices -l
```

También puedes abrir el emulador desde Android Studio en `Device Manager`, o conectar un celular con depuración USB habilitada.

### 3. Compila el frontend para Android

Desde `frontend/`:

```bash
cd frontend
pnpm build:android
```

Este comando genera la carpeta `dist/` usando el modo Android.

### 4. Ejecuta la app con Capacitor

Lista los emuladores disponibles:

```bash
npx cap run android --list
```

Luego ejecuta la app indicando el target. Ejemplo:

```bash
npx cap run android --target CafeSmart_Pixel_5
```

Si usas otro emulador, reemplaza `CafeSmart_Pixel_5` por el nombre que muestre Capacitor o por el nombre de tu AVD.

### 5. Flujo alternativo si Capacitor falla instalando

Si `npx cap run android` compila pero falla en `Deploying app-debug.apk`, puedes instalar el APK manualmente:

```powershell
npx cap sync android
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s emulator-5554 install -r .\android\app\build\outputs\apk\debug\app-debug.apk
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s emulator-5554 shell monkey -p com.cafesmart.app -c android.intent.category.LAUNCHER 1
```

Notas:

- `emulator-5554` es el ID que muestra `adb devices -l` o el comando con la ruta completa de `adb.exe`.
- `CafeSmart_Pixel_5` es el nombre del emulador que usa Capacitor, pero solo aparece como target si el emulador está encendido.
- Si `npx cap run android --target CafeSmart_Pixel_5` muestra `No devices found`, primero arranca el emulador y espera a que `adb devices -l` lo muestre como `device`.
- Si `adb devices -l` muestra `offline`, cierra el emulador y arráncalo con `Cold Boot Now` desde Android Studio.
- Si aparece `Can't find service: package` o `Broken pipe`, el emulador está dañado; usa `Wipe Data` o crea un emulador nuevo.

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

## Pruebas

Para ejecutar las pruebas tanto del frontend como del backend:

```bash
pnpm test .
```

Este comando ejecutará todos los tests disponibles en el proyecto.

## Linting y Formateo de Código

El proyecto ya tiene configurados **ESLint** y **Prettier** para mantener el código limpio y consistente. Los archivos de configuración (`.eslintrc.json` y `.prettierrc`) ya existen en la raíz del proyecto.

### Comandos para usar

Antes de commitear código, ejecuta estos comandos desde la raíz:

```bash
# Formatear todo el código
pnpm format

# Verificar si hay errores de lint
pnpm lint
```

### Si falla el lint

Si `pnpm lint` falla por dependencias faltantes:

```bash
pnpm add -D -w eslint-plugin-prettier eslint-config-prettier prettier
```

### Variables no usadas

Si lint marca una variable como no usada, puedes:
- Eliminarla si no la necesitas
- Usar prefijo `_` si es intencional:
  ```typescript
  const [_variable, setVariable] = useState<tipo[]>([]);
  ```

## Pruebas de escritorio documentadas

- `docs/desktop-test-compras-ventas.md`: validación manual y trazable de compras, ventas, inventario, capacidad de bodega y utilidad bruta.

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
