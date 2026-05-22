import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarHumedadesDto } from './actualizar-humedades.dto';

const SUBLOTE_ID = '11111111-1111-4111-8111-111111111111';

describe('ActualizarHumedadesDto', () => {
  it('acepta humedad entre 8 y 14 inclusive', async () => {
    for (const humedad of [8, 12.5, 14]) {
      const dto = plainToInstance(ActualizarHumedadesDto, {
        sublotes: [{ id: SUBLOTE_ID, humedad }],
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('rechaza humedad fuera del rango 8 a 14', async () => {
    for (const humedad of [7.9, 14.1]) {
      const dto = plainToInstance(ActualizarHumedadesDto, {
        sublotes: [{ id: SUBLOTE_ID, humedad }],
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
    }
  });
});
