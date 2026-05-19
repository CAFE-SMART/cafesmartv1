import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'El token debe ser texto.' })
  @IsNotEmpty({ message: 'El token es obligatorio.' })
  token: string;

  @IsString({ message: 'La nueva contraseña debe ser texto.' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(32, { message: 'La contraseña debe tener máximo 32 caracteres.' })
  @Matches(/[a-z]/, {
    message: 'La contraseña debe incluir una minúscula.',
  })
  @Matches(/[A-Z]/, {
    message: 'La contraseña debe incluir una mayúscula.',
  })
  @Matches(/\d/, {
    message: 'La contraseña debe incluir un número.',
  })
  nuevaPassword: string;
}
