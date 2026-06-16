import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class FinancialAccessService {
  constructor(private readonly authService: AuthService) {}

  async verifyUserPassword(userId: string, password: string) {
    if (!password.trim()) {
      return false;
    }

    try {
      await this.authService.verifyCurrentPassword(userId, password);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return false;
      }

      throw error;
    }
  }
}
