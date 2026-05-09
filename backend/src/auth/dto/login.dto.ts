import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo no parece válido.' })
  @IsNotEmpty({ message: 'Ingresa tu correo electrónico.' })
  email: string;

  @IsNotEmpty({ message: 'Ingresa tu contraseña.' })
  password: string;
}
