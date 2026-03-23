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
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
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
});
