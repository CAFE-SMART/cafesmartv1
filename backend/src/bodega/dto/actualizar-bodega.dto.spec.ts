import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ActualizarBodegaDto } from './actualizar-bodega.dto';

describe('ActualizarBodegaDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('acepta nombreBodega y capacidadKg como propiedades validas', async () => {
    const result = await pipe.transform(
      {
        nombreBodega: 'Bodega principal',
        capacidadKg: '3000',
      },
      {
        type: 'body',
        metatype: ActualizarBodegaDto,
      },
    );

    expect(result).toEqual({
      nombreBodega: 'Bodega principal',
      capacidadKg: 3000,
    });
  });

  it('rechaza capacidades vacias o menores a cero', async () => {
    await expect(
      pipe.transform(
        {
          nombreBodega: 'Bodega principal',
          capacidadKg: 0,
        },
        {
          type: 'body',
          metatype: ActualizarBodegaDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
