/*
 * ========================================================
 * 🚀 ARCHIVO: main.ts (El Motor del Backend)
 * ========================================================
 * ¿Para qué sirve?: Es lo primero que se ejecuta cuando levantamos el servidor (NestJS).
 * Enciende el servidor, habilita la conexión segura (CORS) y le dice en qué puerto escuchar.
 * 
 * ¿Debo editarlo?: ⛔ NO. Este archivo se configura una vez y rara vez se vuelve a tocar,
 * a menos que quieran agregar prefijos globales a las rutas de las API o Swagger.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS para una conexion sin errores entre el Frontend y el Backend
  app.enableCors();
  
  // Escuchar en puerto 0.0.0.0
  await app.listen(3000, '0.0.0.0');
  console.log('🚀 Backend CAFE SMART corriendo en el puerto 3000');
}
bootstrap();