import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TipoOrganizacion } from '@prisma/client';
import { RegisterDto } from './register.dto';
import { RegisterGoogleDto } from './register-google.dto';

const baseRegister = {
  nombreOrganizacion: 'Café Smart',
  tipoOrganizacion: TipoOrganizacion.COMPRAVENTA,
  nombre: 'Ana Perez',
  telefono: '3001234567',
  correo: 'ana@example.com',
  password: 'Cafe123',
};

const baseGoogleRegister = {
  ...baseRegister,
  googleToken: 'google-token',
};

describe('registro nombreOrganizacion', () => {
  it('acepta nombres con letras, espacios y maximo cinco numeros', async () => {
    for (const nombreOrganizacion of [
      'C',
      'JR',
      '3M',
      'D1',
      'Café Los Alpes',
      'Compraventa JR Asociados',
      'Cafe Ruta 12345',
    ]) {
      const dto = plainToInstance(RegisterDto, {
        ...baseRegister,
        nombreOrganizacion,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('rechaza nombres vacios o formados solo por simbolos', async () => {
    for (const nombreOrganizacion of [
      '',
      '   ',
      '---',
      '@@@@',
      '""""',
      'Cafe Smart!',
      'Cafe Ruta 123456',
      '999999999',
      '123456',
      '43252566362232626',
    ]) {
      const dto = plainToInstance(RegisterDto, {
        ...baseRegister,
        nombreOrganizacion,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toEqual(
        expect.objectContaining({
          matches: 'Ingresa un nombre de negocio válido.',
        }),
      );
    }
  });

  it('aplica la misma regla al registro con Google', async () => {
    const validDto = plainToInstance(RegisterGoogleDto, {
      ...baseGoogleRegister,
      nombreOrganizacion: '3M',
    });
    const invalidDto = plainToInstance(RegisterGoogleDto, {
      ...baseGoogleRegister,
      nombreOrganizacion: '999999999',
    });

    await expect(validate(validDto)).resolves.toHaveLength(0);
    const errors = await validate(invalidDto);
    expect(errors[0].constraints).toEqual(
      expect.objectContaining({
        matches: 'Ingresa un nombre de negocio válido.',
      }),
    );
  });

  it('exige telefono del administrador con 10 digitos y que empiece por 3', async () => {
    for (const telefono of ['3001234567', '3120000000']) {
      const dto = plainToInstance(RegisterDto, {
        ...baseRegister,
        telefono,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    }

    for (const telefono of [
      '+57 300 123 4567',
      '2001234567',
      '30012345678',
      '300123456',
      '300abc4567',
    ]) {
      const dto = plainToInstance(RegisterDto, {
        ...baseRegister,
        telefono,
      });
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('telefono');
    }
  });

  it('rechaza numeros y caracteres especiales en el nombre del administrador', async () => {
    for (const nombre of ['Ana Perez', 'María Fernanda']) {
      const dto = plainToInstance(RegisterDto, {
        ...baseRegister,
        nombre,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    }

    for (const nombre of ['Ana Perez 2', 'Ana-Perez', 'Ana.Perez']) {
      const dto = plainToInstance(RegisterDto, {
        ...baseRegister,
        nombre,
      });
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('nombre');
    }
  });
});
