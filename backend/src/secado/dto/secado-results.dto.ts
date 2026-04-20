import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class SecadoResultsDto {
  @IsNumber()
  @Min(0)
  outputBuenoKg!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  outputBuenoHumedad?: number;

  @IsNumber()
  @Min(0)
  outputRegularKg!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  outputRegularHumedad?: number;
}