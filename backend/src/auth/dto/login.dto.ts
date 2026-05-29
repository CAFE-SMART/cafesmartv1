import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'Ingresa un correo valido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  @MaxLength(70, { message: 'El correo no puede superar 70 caracteres.' })
  email: string;

  @IsNotEmpty({ message: 'La contrasena es obligatoria.' })
  @MaxLength(72, { message: 'La contrasena no puede superar 72 caracteres.' })
  password: string;
}
