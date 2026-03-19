/*
 * ========================================================
 * 🧩 ARCHIVO: app.module.ts (El Tablero Eléctrico del Backend)
 * ========================================================
 * ¿Para qué sirve?: En NestJS, todo funciona por "Módulos". Este archivo es el más
 * grande de todos. Aquí es donde conectas todos los cablecitos de tu proyecto.
 * 
 * ¿Debo editarlo?: ✅ SÍ. Cada vez que creen un Módulo nuevo (ej: el módulo
 * de Usuarios o Ventas), tienen que venir aquí e importarlo en el arreglo de "imports: []".
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
