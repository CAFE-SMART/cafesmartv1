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
  it('acepta nombres cortos y nombres comerciales comunes', async () => {
    for (const nombreOrganizacion of [
      'C',
      'JR',
      '3M',
      'D1',
      'Café Los Alpes',
      "Cooperativa O'Campo",
      'Compraventa JR & Asociados',
      'Café Ruta-24',
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
});
