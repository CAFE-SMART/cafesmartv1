import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GuardarClienteDto {
  @IsString({ message: 'El nombre del cliente debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del cliente es obligatorio' })
  @MaxLength(120, {
    message: 'El nombre del cliente no puede exceder 120 caracteres',
  })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'El documento del cliente debe ser texto' })
  @MaxLength(40, {
    message: 'El documento del cliente no puede exceder 40 caracteres',
  })
  documento?: string;

  @IsOptional()
  @IsString({ message: 'Selecciona el tipo de documento.' })
  tipoDocumento?: 'CEDULA' | 'NIT' | 'TI' | 'CE' | 'PASAPORTE' | 'PEP' | 'OTRO';

  @IsOptional()
  @IsString({ message: 'El telefono del cliente debe ser texto' })
  @MaxLength(40, {
    message: 'El telefono del cliente no puede exceder 40 caracteres',
  })
  telefono?: string;
}
