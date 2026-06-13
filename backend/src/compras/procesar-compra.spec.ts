import {
  CompraValidacionCriticaError,
  evaluarCapacidadCompra,
  procesarCompra,
} from './procesar-compra';
import type { ContextoCapacidadCompra } from './procesar-compra';

describe('evaluarCapacidadCompra - QA Tests de Capacidad de Bodega', () => {
  describe('Escenario 1: Bodega con espacio disponible', () => {
    it('debería permitir compra cuando hay suficiente espacio (debajo del 80%)', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 500,
      };

      const resultado = evaluarCapacidadCompra(200, contexto);

      expect(resultado.warning).toBeUndefined();
      expect(resultado.exceso).toBeUndefined();
      expect(resultado.capacidad.nivel).toBe('normal');
    });

    it('debería permitir compra cuando el inventario está vacío', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 0,
      };

      const resultado = evaluarCapacidadCompra(100, contexto);

      expect(resultado.warning).toBeUndefined();
      expect(resultado.exceso).toBeUndefined();
      expect(resultado.capacidad.nivel).toBe('normal');
    });

    it('debería permitir compra pequeña cuando el inventario está casi lleno pero debajo del 80%', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 799,
      };

      const resultado = evaluarCapacidadCompra(0.5, contexto);

      expect(resultado.warning).toBeUndefined();
      expect(resultado.exceso).toBeUndefined();
      expect(resultado.capacidad.nivel).toBe('normal');
    });

    it('debería manejar valores decimales correctamente', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000.5,
        inventarioActualKg: 400.25,
      };

      const resultado = evaluarCapacidadCompra(199.75, contexto);

      expect(resultado.warning).toBeUndefined();
      expect(resultado.exceso).toBeUndefined();
      expect(resultado.capacidad.nivel).toBe('normal');
    });
  });

  describe('Escenario 2: Bodega al límite exacto (80% - alerta)', () => {
    it('debería generar warning cuando la compra llega exactamente al 80%', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 700,
      };

      const resultado = evaluarCapacidadCompra(100, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('nivel de alerta');
      expect(resultado.warning).toContain('800 kg');
      expect(resultado.warning).toContain('1000 kg');
      expect(resultado.exceso).toBeUndefined();
    });

    it('debería generar warning cuando la compra supera el 80%', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 750,
      };

      const resultado = evaluarCapacidadCompra(100, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('nivel de alerta');
      expect(resultado.warning).toContain('850 kg');
      expect(resultado.warning).toContain('1000 kg');
      expect(resultado.exceso).toBeUndefined();
    });

    it('debería generar warning cuando el inventario ya está al 80% sin compra', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 800,
      };

      const resultado = evaluarCapacidadCompra(0, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('nivel de alerta');
      expect(resultado.exceso).toBeUndefined();
    });

    it('debería manejar el límite del 80% con decimales', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 799.99,
      };

      const resultado = evaluarCapacidadCompra(0.01, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('nivel de alerta');
      expect(resultado.exceso).toBeUndefined();
    });
  });

  describe('Escenario 3: Compra que supera la capacidad configurada', () => {
    it('debería detectar exceso cuando la compra supera la capacidad total', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 900,
      };

      const resultado = evaluarCapacidadCompra(200, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('supera la capacidad');
      expect(resultado.warning).toContain('1100 kg');
      expect(resultado.warning).toContain('1000 kg');
      expect(resultado.exceso).toBeDefined();
      expect(resultado.exceso).toBe(100);
    });

    it('debería calcular el exceso exacto correctamente', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 950,
      };

      const resultado = evaluarCapacidadCompra(100, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.exceso).toBe(50);
    });

    it('debería detectar exceso incluso cuando el inventario está vacío pero la compra es mayor a la capacidad', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 0,
      };

      const resultado = evaluarCapacidadCompra(1500, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('supera la capacidad');
      expect(resultado.exceso).toBe(500);
    });

    it('debería manejar exceso con decimales', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 999.5,
      };

      const resultado = evaluarCapacidadCompra(1.5, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.exceso).toBeCloseTo(1, 1);
    });

    it('debería priorizar el error de exceso sobre el warning del 80%', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 850,
      };

      const resultado = evaluarCapacidadCompra(200, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('supera la capacidad');
      expect(resultado.exceso).toBeDefined();
      expect(resultado.exceso).toBe(50);
    });
  });

  describe('Casos borde y validaciones', () => {
    it('debería manejar capacidad cero o negativa sin evaluar', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 0,
        inventarioActualKg: 100,
      };

      const resultado = evaluarCapacidadCompra(50, contexto);

      expect(resultado.capacidad.validada).toBe(false);
      expect(resultado.capacidad.nivel).toBe('sin_validacion');
    });

    it('debería manejar capacidad negativa sin evaluar', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: -100,
        inventarioActualKg: 50,
      };

      const resultado = evaluarCapacidadCompra(25, contexto);

      expect(resultado.capacidad.validada).toBe(false);
      expect(resultado.capacidad.nivel).toBe('sin_validacion');
    });

    it('debería manejar compra de cero kg', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 500,
      };

      const resultado = evaluarCapacidadCompra(0, contexto);

      expect(resultado.capacidad.nivel).toBe('normal');
    });

    it('debería manejar inventario actual negativo (caso borde)', () => {
      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: -50,
      };

      const resultado = evaluarCapacidadCompra(100, contexto);

      expect(resultado.capacidad.nivel).toBe('normal');
    });
  });

  describe('Integración con procesarCompra', () => {
    it('bloquea una compra con cantidad menor o igual a cero', () => {
      expect(() =>
        procesarCompra({
          deviceId: 'device-1',
          localId: 'local-1',
          fecha: '2024-01-01',
          sublotes: [
            {
              deviceId: 'device-1',
              localId: 'sub-1',
              tipoCafeId: 'tipo-1',
              calidadId: 'calidad-1',
              pesoInicial: 0,
              precioKg: 1000,
            },
          ],
        }),
      ).toThrow(CompraValidacionCriticaError);
    });

    it('bloquea una compra con precio menor a 1000', () => {
      expect(() =>
        procesarCompra({
          deviceId: 'device-1',
          localId: 'local-1',
          fecha: '2024-01-01',
          sublotes: [
            {
              deviceId: 'device-1',
              localId: 'sub-1',
              tipoCafeId: 'tipo-1',
              calidadId: 'calidad-1',
              pesoInicial: 10,
              precioKg: 999,
            },
          ],
        }),
      ).toThrow(CompraValidacionCriticaError);
    });

    it('debería incluir evaluación de capacidad en el resultado procesado', () => {
      const input = {
        deviceId: 'device-1',
        localId: 'local-1',
        fecha: '2024-01-01',
        sublotes: [
          {
            deviceId: 'device-1',
            localId: 'sub-1',
            tipoCafeId: 'tipo-1',
            calidadId: 'calidad-1',
            pesoInicial: 200,
            precioKg: 1000,
          },
        ],
      };

      const contexto: ContextoCapacidadCompra = {
        capacidadBodegaKg: 1000,
        inventarioActualKg: 900,
      };

      const resultado = procesarCompra(input, contexto);

      expect(resultado.warning).toBeDefined();
      expect(resultado.warning).toContain('supera la capacidad');
      expect(resultado.exceso).toBeDefined();
      expect(resultado.compra.totalKg).toBe(200);
    });

    it('debería exigir configuración sin contexto de capacidad', () => {
      const input = {
        deviceId: 'device-1',
        localId: 'local-1',
        fecha: '2024-01-01',
        sublotes: [
          {
            deviceId: 'device-1',
            localId: 'sub-1',
            tipoCafeId: 'tipo-1',
            calidadId: 'calidad-1',
            pesoInicial: 200,
            precioKg: 1000,
          },
        ],
      };

      const resultado = procesarCompra(input, null);

      expect(resultado.warning).toBeUndefined();
      expect(resultado.exceso).toBeUndefined();
      expect(resultado.capacidad.validada).toBe(false);
      expect(resultado.capacidad.nivel).toBe('normal');
      expect(resultado.compra.totalKg).toBe(200);
    });

    it('debería exigir configuración sin contexto de capacidad (undefined)', () => {
      const input = {
        deviceId: 'device-1',
        localId: 'local-1',
        fecha: '2024-01-01',
        sublotes: [
          {
            deviceId: 'device-1',
            localId: 'sub-1',
            tipoCafeId: 'tipo-1',
            calidadId: 'calidad-1',
            pesoInicial: 200,
            precioKg: 1000,
          },
        ],
      };

      const resultado = procesarCompra(input, undefined);

      expect(resultado.warning).toBeUndefined();
      expect(resultado.exceso).toBeUndefined();
      expect(resultado.capacidad.validada).toBe(false);
      expect(resultado.capacidad.nivel).toBe('normal');
      expect(resultado.compra.totalKg).toBe(200);
    });
  });
});
