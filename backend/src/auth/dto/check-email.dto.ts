import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class CheckEmailDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail({}, { message: 'El correo debe tener un formato valido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  correo: string;
}
