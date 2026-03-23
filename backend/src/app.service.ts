/*
 * ========================================================
 * 🔧 ARCHIVO: app.service.ts (El Servicio Raíz - Solo de Prueba)
 * ========================================================
 * ¿Para qué sirve?: Es el servicio de prueba que acompaña al app.controller.ts.
 * Solo tiene el método getHello() que devuelve un texto para confirmar que
 * el servidor funciona.
 *
 * ¿Debo editarlo?: ⛔ NO. No tiene lógica de negocio. Solo existe para
 * confirmar que el servidor enciende. La lógica real va en los servicios
 * de cada módulo (auth.service, user.services, etc.).
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Cafe Smart API running';
  }
}

