import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FinancialAccessService } from './financial-access.service';

@Controller('financial-access')
export class FinancialAccessController {
  constructor(private readonly financialAccessService: FinancialAccessService) {}

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() dto: { password?: string },
    @Req() req: { user: { sub: string } },
  ) {
    const authorized = await this.financialAccessService.verifyUserPassword(
      req.user.sub,
      dto.password ?? '',
    );

    if (!authorized) {
      throw new ForbiddenException({
        ok: false,
        message: 'La contraseña no es correcta',
      });
    }

    return {
      ok: true,
      message: 'Acceso financiero autorizado',
    };
  }
}
