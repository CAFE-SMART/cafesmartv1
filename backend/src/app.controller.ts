/*
 * ========================================================
 * 🏁 ARCHIVO: app.controller.ts (El Controlador Raíz - Solo de Prueba)
 * ========================================================
 * ¿Para qué sirve?: Es el controlador principal que viene por defecto con NestJS.
 * Tiene una ruta GET / que responde "Hello World!" para confirmar que el 
 * servidor está encendido y funcionando correctamente.
 *
 * ¿Debo editarlo?: ⛔ NO. Este archivo se usa solo para probar que el
 * servidor arranca bien. No es donde va la lógica del negocio.
 * El negocio va en módulos como auth/, users/, lotes/, ventas/.
 */
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

