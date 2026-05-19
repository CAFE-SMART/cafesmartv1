import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @Transform(({ obj, value }) =>
    String(value ?? obj?.correo ?? '')
      .trim()
      .toLowerCase(),
  )
  @IsEmail({}, { message: 'El correo debe tener un formato valido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  email: string;
}
