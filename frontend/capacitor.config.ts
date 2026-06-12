/*
 * ========================================================
 * 📱 ARCHIVO: capacitor.config.ts (El Contrato de la App Móvil)
 * ========================================================
 * ¿Para qué sirve?: Le dice a Capacitor cómo debe empaquetar tu app
 * de React para convertirla en una App Android real.
 *
 *   appId: 'com.cafesmart.app'  →  El ID único de tu app en Google Play
 *   appName: 'CafeSmart'        →  El nombre que verás en el celular
 *   webDir: 'dist'              →  Le dice que tome los archivos de la
 *                                   carpeta que genera "pnpm build"
 *
 * ¿Debo editarlo?: ⛔ NO. Solo se editaría si cambia el nombre o ID de la app.
 *
 * Flujo para ver la app en Android:
 *   1. pnpm build:android     -> genera dist/ usando .env.android
 *   2. npx cap sync android   -> copia dist/ al proyecto Android
 *   3. npx cap open android → abre Android Studio para correr la app
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cafesmart.app',
  appName: 'CafeSmart',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;
