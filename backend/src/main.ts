import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS para una conexion sin errores
  app.enableCors();
  
  // Escuchar en puerto 0.0.0.0
  await app.listen(3000, '0.0.0.0');
  console.log('🚀 Backend CAFE SMART corriendo en el puerto 3000');
}
bootstrap();