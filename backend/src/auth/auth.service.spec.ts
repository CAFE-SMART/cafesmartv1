import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService password reset', () => {
  function crearServicio() {
    const usersService = {
      findByEmail: jest.fn(),
    };
    const tx = {
      passwordResetToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      user: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      passwordResetToken: {
        findUnique: jest.fn(),
      },
    };
    const jwtService = {
      sign: jest.fn(),
      verifyAsync: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          FRONTEND_URL: 'http://localhost:5173',
          NODE_ENV: 'test',
          RESEND_API_KEY: 'resend-key',
          EMAIL_FROM: 'Cafe Smart <soporte@cafesmart.com>',
        };
        return values[key];
      }),
    };
    const service = new AuthService(
      usersService as never,
      prisma as never,
      jwtService as never,
      configService as never,
    );

    jest
      .spyOn(service as unknown as { sendPasswordResetEmail: jest.Mock }, 'sendPasswordResetEmail')
      .mockResolvedValue(undefined);

    return { service, usersService, prisma, tx };
  }

  it('genera un token de 15 minutos, guarda solo el hash y revoca enlaces anteriores', async () => {
    const { service, usersService, tx } = crearServicio();
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      correo: 'admin@cafesmart.com',
    });

    await service.forgotPassword('ADMIN@CAFESMART.COM');

    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          usedAt: null,
          revokedAt: null,
        },
      }),
    );
    const createCall = tx.passwordResetToken.create.mock.calls[0][0];
    const tokenHash = createCall.data.tokenHash as string;
    const expiresAt = createCall.data.expiresAt as Date;
    const sentUrl = (
      service as unknown as { sendPasswordResetEmail: jest.Mock }
    ).sendPasswordResetEmail.mock.calls[0][1] as string;
    const sentToken = new URL(sentUrl).searchParams.get('token') ?? '';

    expect(sentToken).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(sentToken);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('rechaza un token vencido antes de mostrar o cambiar contraseña', async () => {
    const { service, prisma } = crearServicio();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: { id: 'user-1', activo: true },
    });

    await expect(
      service.validateResetPasswordToken('token-plano'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca el token como usado despues de actualizar la contraseña', async () => {
    const { service, prisma, tx } = crearServicio();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', activo: true },
    });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.resetPassword('token-plano', 'NuevaClave123!'),
    ).resolves.toMatchObject({
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1', activo: true },
      }),
    );
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'reset-1',
          usedAt: null,
          revokedAt: null,
        }),
        data: expect.objectContaining({
          usedAt: expect.any(Date),
        }),
      }),
    );
  });
});
