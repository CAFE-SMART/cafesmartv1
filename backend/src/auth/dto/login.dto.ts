import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'Ingresa un correo valido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  email: string;

  @IsNotEmpty({ message: 'La contrasena es obligatoria.' })
  password: string;
}
