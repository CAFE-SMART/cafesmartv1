import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, Length, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'Ingresa un correo valido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  @MaxLength(70, { message: 'El correo no puede superar 70 caracteres.' })
  email: string;

  @IsNotEmpty({ message: 'El código es obligatorio.' })
  @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos.' })
  code: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @Length(6, 72, {
    message: 'La contraseña debe tener entre 6 y 72 caracteres.',
  })
  password: string;
}
