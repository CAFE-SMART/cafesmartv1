import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const CONTACTO_ROLES = ['CLIENTE', 'PRODUCTOR'] as const;
export type ContactoRol = (typeof CONTACTO_ROLES)[number];

export class GuardarContactoDto {
  @IsString({ message: 'El nombre del contacto debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del contacto es obligatorio' })
  @MaxLength(120, {
    message: 'El nombre del contacto no puede exceder 120 caracteres',
  })
  nombre: string;

  @IsString({ message: 'El documento del contacto debe ser texto' })
  @IsNotEmpty({ message: 'El documento del contacto es obligatorio' })
  @MaxLength(40, {
    message: 'El documento del contacto no puede exceder 40 caracteres',
  })
  documento: string;

  @IsString({ message: 'Selecciona el tipo de documento.' })
  @IsIn(['CEDULA', 'NIT', 'TI', 'CE', 'PASAPORTE', 'PEP', 'OTRO'], {
    message: 'Selecciona un tipo de documento válido.',
  })
  tipoDocumento: 'CEDULA' | 'NIT' | 'TI' | 'CE' | 'PASAPORTE' | 'PEP' | 'OTRO';

  @IsOptional()
  @IsString({ message: 'El telefono del contacto debe ser texto' })
  @MaxLength(40, {
    message: 'El telefono del contacto no puede exceder 40 caracteres',
  })
  telefono?: string;

  @IsArray({ message: 'Selecciona al menos un rol para el contacto.' })
  @ArrayNotEmpty({ message: 'Selecciona al menos un rol para el contacto.' })
  @IsIn(CONTACTO_ROLES, {
    each: true,
    message: 'Selecciona roles válidos para el contacto.',
  })
  roles: ContactoRol[];
}

export class AgregarRolContactoDto {
  @IsString({ message: 'Selecciona el rol que deseas agregar.' })
  @IsIn(CONTACTO_ROLES, {
    message: 'Selecciona un rol válido para el contacto.',
  })
  rol: ContactoRol;
}
