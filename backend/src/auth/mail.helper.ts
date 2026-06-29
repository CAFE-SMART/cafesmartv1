import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export async function sendRecoveryEmail(
  configService: ConfigService,
  to: string,
  code: string,
): Promise<boolean> {
  const host = configService.get<string>('SMTP_HOST');
  const port = configService.get<number>('SMTP_PORT');
  const user = configService.get<string>('SMTP_USER');
  const pass = configService.get<string>('SMTP_PASS');
  const from =
    configService.get<string>('SMTP_FROM') ||
    '"Café Smart" <no-reply@cafesmart.com>';

  // Fallback if config is missing
  if (!host || !port || !user || !pass) {
    console.log('------------------------------------------------------------');
    console.log(`[SMTP CONFIG MISSING] Fallback to Console Log.`);
    console.log(`[PASSWORD RESET] Email: ${to} | Code: ${code}`);
    console.log('------------------------------------------------------------');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465, // true for port 465 (SSL), false for 587 (TLS/STARTTLS)
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from,
      to,
      subject: 'Código de recuperación de contraseña - Café Smart',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #1D4ED8; margin: 0; font-size: 28px;">Café Smart</h1>
            <p style="color: #718096; font-size: 14px; margin-top: 5px;">Recuperación de Contraseña</p>
          </div>
          <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
            <p style="font-size: 16px; color: #334155; margin-top: 0;">Has solicitado restablecer tu contraseña. Utiliza el siguiente código de verificación de 6 dígitos:</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; margin: 24px 0; padding: 12px 24px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9999px; display: inline-block;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 0; line-height: 1.5;">Este código es válido por 15 minutos.<br>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
          </div>
          <div style="margin-top: 25px; text-align: center; font-size: 11px; color: #94a3b8;">
            &copy; 2026 Café Smart. Todos los derechos reservados.
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP EMAIL SENT] Message ID: ${info.messageId} to ${to}`);
    return true;
  } catch (error) {
    console.error(`[SMTP ERROR] Failed to send email to ${to}:`, error);
    console.log('------------------------------------------------------------');
    console.log(`[FALLBACK LOG] Email: ${to} | Code: ${code}`);
    console.log('------------------------------------------------------------');
    return false;
  }
}
