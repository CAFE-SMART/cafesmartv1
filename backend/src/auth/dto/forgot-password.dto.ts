import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'Ingresa un correo valido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  @MaxLength(70, { message: 'El correo no puede superar 70 caracteres.' })
  email: string;
}
