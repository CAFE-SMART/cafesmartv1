import { IsOptional, IsString, IsNumber } from 'class-validator';

export class SaveSecadoDraftDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  buenoKg?: number;

  @IsOptional()
  @IsNumber()
  regularKg?: number;

  @IsOptional()
  @IsNumber()
  maloKg?: number;
}
