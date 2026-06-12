import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVentaDto } from './crear-venta.dto';

const SUBLOTE_ID = '11111111-1111-4111-8111-111111111111';

describe('CreateVentaDto', () => {
  const base = {
    deviceId: 'device-1',
    localId: 'venta-1',
    detalles: [
      {
        subloteId: SUBLOTE_ID,
        pesoVendido: 5,
        precioKg: 12000,
      },
    ],
  };

  it('acepta ventas mayores a 99.999 kg para permitir vender todo el inventario disponible', async () => {
    const dto = plainToInstance(CreateVentaDto, {
      ...base,
      detalles: [{ ...base.detalles[0], pesoVendido: 150000 }],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza detalles con peso menor a 0.01 kg', async () => {
    const dto = plainToInstance(CreateVentaDto, {
      ...base,
      detalles: [{ ...base.detalles[0], pesoVendido: 0 }],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });
});
