import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString({ message: 'El token de Google debe ser texto.' })
  @IsNotEmpty({ message: 'No se recibio el token de Google.' })
  idToken: string;
}
