// ============================================================
// main.ts — El Motor del Backend
// ============================================================
// Es lo primero que se ejecuta cuando levantamos el servidor.
// Enciende NestJS, activa validaciones globales y habilita CORS.
// ============================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: permite que el frontend se conecte al backend sin errores
  app.enableCors();

  // ValidationPipe global: activa las validaciones de todos los DTOs.
  // whitelist: true → descarta cualquier campo extra que no esté en el DTO
  // forbidNonWhitelisted: true → retorna error 400 si vienen campos no permitidos
  // transform: true → convierte los datos al tipo correcto (ej: string → enum)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000, '0.0.0.0');
  console.log('🚀 Backend CAFE SMART corriendo en el puerto 3000');
}
bootstrap();