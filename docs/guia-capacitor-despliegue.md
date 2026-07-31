# Guía de Compilación y Despliegue con Capacitor 📱🚀

Esta guía explica el proceso paso a paso para sincronizar el código del Frontend en React + Vite de **Café Smart** con el proyecto móvil nativo utilizando **Capacitor** y compilar la aplicación para Android.

---

## 1. Requisitos Previos 📋
Antes de comenzar, asegúrate de tener instalado en tu sistema:
1. **Node.js** (versión 22 o superior).
2. **Android Studio** (con SDK de Android configurado).
3. Dispositivo Android físico conectado por USB con Depuración USB activa, o un emulador configurado en Android Studio.

---

## 2. Flujo de Compilación y Sincronización 🔄

Cada vez que realices cambios en el frontend (código React) y quieras probarlos en la aplicación móvil o generar un nuevo ejecutable, debes ejecutar la siguiente secuencia de comandos desde la raíz del monorepo:

### Paso 1: Compilar el Frontend
Este paso genera los archivos estáticos de producción (HTML, JS, CSS) de React en la carpeta `frontend/dist/`:
```bash
pnpm --filter cafe-smart-frontend build
```

### Paso 2: Sincronizar con el proyecto Android
Este paso copia los archivos estáticos generados y actualiza los plugins de Capacitor en la carpeta nativa `frontend/android/`:
```bash
npx cap sync
```
*(Nota: Ejecuta este comando dentro de la carpeta `frontend/` o usa la ruta correspondiente si estás en el directorio raíz).*

### Paso 3: Abrir Android Studio
Abre el editor nativo de Android cargando el proyecto generado en `frontend/android/`:
```bash
npx cap open android
```

---

## 3. Configuración de Variables de Entorno en Producción 🌐

Para la aplicación móvil de producción, el backend debe estar expuesto a través de una URL pública (por ejemplo, en Render, Railway, AWS o Heroku) en lugar de usar `localhost`.

1. Revisa o edita el archivo `frontend/.env.production` (o el `.env` que uses para producción):
   ```env
   VITE_API_URL="https://tu-api-cafesmart.com/api"
   ```
2. Asegúrate de compilar la app con el entorno correcto para que tome esa variable:
   ```bash
   # Dentro de la carpeta frontend
   pnpm build
   ```

---

## 4. Compilación del APK en Android Studio 🛠️

Una vez que Android Studio esté abierto con el proyecto móvil:

### Generar APK de Pruebas (Debug APK)
Ideal para instalar rápidamente en tu celular y testear localmente:
1. En la barra superior de Android Studio, ve a: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2. Android Studio compilará el proyecto en segundo plano.
3. Al finalizar, aparecerá una notificación abajo a la derecha con un enlace **locate**. Haz clic para abrir la carpeta que contiene el archivo `app-debug.apk`.
4. Envía este archivo a tu dispositivo móvil para instalarlo.

### Generar APK de Producción Firmado (Release APK / AAB)
Requerido para subir la aplicación a Google Play Store o distribución final oficial:
1. En Android Studio, ve a: **Build** > **Generate Signed Bundle / APK...**
2. Selecciona **APK** (o **Android App Bundle** si vas a subir directamente a Google Play Store) y haz clic en **Next**.
3. **Key store path:** Crea un nuevo almacén de claves (Keystore) si no tienes uno (`Create new...`) o selecciona tu firma existente. Rellena las contraseñas requeridas.
4. Selecciona el tipo de compilación: **release**.
5. Selecciona la firma de firma de versión de destino (V1 y/o V2) y haz clic en **Finish**.
6. El APK firmado de producción se generará en la carpeta `android/app/release/`.

---

## 5. Solución de Problemas Comunes (FAQ) 🔍

* **Error: "Localhost rechazó la conexión" en el celular:**
  Asegúrate de que no estás apuntando a `http://localhost:3000` o `http://127.0.0.1:3000` en tu archivo `.env` del móvil, ya que el emulador o celular físico interpretará `localhost` como sí mismo, no como tu computador. Configura la IP local de tu máquina de desarrollo (ej: `http://192.168.1.50:3000`) o la URL pública de producción.
* **Cambios en React no se ven en el celular:**
  Recuerda que debes ejecutar `pnpm build` antes de `npx cap sync`. Si haces sync sin compilar primero, Capacitor sincronizará una versión antigua del directorio `dist`.
