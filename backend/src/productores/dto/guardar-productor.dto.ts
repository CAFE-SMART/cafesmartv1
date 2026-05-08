import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GuardarProductorDto {
  @IsString({ message: 'El nombre del productor debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del productor es obligatorio' })
  @MaxLength(120, {
    message: 'El nombre del productor no puede exceder 120 caracteres',
  })
  nombre: string;

  @IsString({ message: 'El documento del productor debe ser texto' })
  @IsNotEmpty({ message: 'El documento del productor es obligatorio' })
  @MaxLength(40, {
    message: 'El documento del productor no puede exceder 40 caracteres',
  })
  documento: string;

  @IsOptional()
  @IsString({ message: 'El telefono del productor debe ser texto' })
  @MaxLength(40, {
    message: 'El telefono del productor no puede exceder 40 caracteres',
  })
  telefono?: string;
}
