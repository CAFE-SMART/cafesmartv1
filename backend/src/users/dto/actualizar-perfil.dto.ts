import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarPerfilDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(60, { message: 'El nombre no puede superar los 60 caracteres.' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(60, { message: 'El correo no puede superar los 60 caracteres.' })
  correo: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede superar los 20 caracteres.' })
  telefono?: string | null;
}
