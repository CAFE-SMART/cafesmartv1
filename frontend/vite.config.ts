/*
 * ========================================================
 * ⚡ ARCHIVO: vite.config.ts (El Motor de Desarrollo del Frontend)
 * ========================================================
 * ¿Para qué sirve?: Configura Vite, la herramienta que enciende el servidor
 * local de desarrollo y que compila el código de React en archivos listos
 * para producción (la carpeta dist/).
 *
 * ¿Debo editarlo?: ⚠️ POCO. Solo si necesitas configurar algo específico
 * como un proxy para evitar errores de CORS durante desarrollo o agregar
 * alias de rutas para importar archivos de forma más fácil.
 *
 * Alias útil: Con el alias "@" puedes importar así:
 *   import Login from '@/pages/Login'  (en vez de '../../../pages/Login')
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Café Smart',
        short_name: 'CaféSmart',
        description: 'Administración inteligente para productores de café',
        theme_color: '#1D4ED8',
        background_color: '#f4f7fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Permite usar "@/componente" en lugar de rutas relativas largas
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Redirige las llamadas al backend durante desarrollo (evita errores de CORS)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    // Evita advertencias por chunks grandes en builds de entrega.
    // A futuro, se puede optimizar con lazy loading/dynamic import().
    chunkSizeWarningLimit: 1000,
  },
});
