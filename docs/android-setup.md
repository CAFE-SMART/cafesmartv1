# Configuracion Android de CafeSmart

Esta guia deja un flujo comun para correr CafeSmart en Android sin depender de rutas locales de un equipo especifico.

## Requisitos

- Node.js instalado.
- pnpm instalado. Recomendado: `corepack enable`.
- Android Studio instalado.
- Android SDK instalado.
- JDK compatible con Android Studio y Gradle.
- Un emulador creado o un celular con depuracion USB activa.

En Windows, Android Studio suele configurar el SDK en:

```powershell
$env:LOCALAPPDATA\Android\Sdk
```

Tambien puedes definir `ANDROID_HOME` o `ANDROID_SDK_ROOT` apuntando a la carpeta del SDK.

## Variables de entorno

Copia los archivos de ejemplo:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Para web local, conserva `frontend/.env` apuntando al backend local:

```env
VITE_API_URL=http://localhost:3000
```

Para Android, usa `frontend/.env.android`. El flujo `pnpm build:android` carga ese archivo porque ejecuta Vite con `--mode android`.

Para usar el backend propio desplegado en Render:

```env
VITE_API_URL=https://cafesmart-v1.onrender.com
```

Para Android real con backend local, no uses `localhost`. En un celular, `localhost` apunta al celular, no a tu PC.

Usa la IP de tu equipo en la red:

```env
VITE_API_URL=http://IP_DEL_PC:3000
```

Para emulador Android, normalmente puedes usar:

```env
VITE_API_URL=http://10.0.2.2:3000
```

## Flujo oficial manual

Desde la raiz del repositorio:

```powershell
pnpm install
pnpm --filter cafe-smart-frontend build:android
```

Luego:

```powershell
cd frontend
pnpm exec cap sync android
pnpm exec cap open android
```

## Flujo con script

Desde `frontend`:

```powershell
pnpm android:run
```

Variantes utiles:

```powershell
pnpm android:fast
pnpm android:launch
pnpm android:full
```

El script verifica `node`, `pnpm`, `adb` y el emulador, compila la web con `build:android`, sincroniza Capacitor y abre CafeSmart en Android.

## Configuracion esperada

`frontend/capacitor.config.ts` debe mantenerse asi salvo que cambie la identidad de la app:

```ts
appId: 'com.cafesmart.app'
appName: 'CafeSmart'
webDir: 'dist'
```

No cambies a `package-lock.json`; el proyecto usa pnpm y `pnpm-lock.yaml`.
