import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 12;

function loadBackendEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadBackendEnv();

const prisma = new PrismaClient();

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}

function getRequiredInput(name: string, envName: string) {
  return (getArgValue(name) ?? process.env[envName] ?? '').trim();
}

function assertSafeEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasExplicitOverride =
    process.env.ALLOW_PRODUCTION_TEST_PASSWORD_RESET === 'true';

  if (isProduction && !hasExplicitOverride) {
    throw new Error(
      'Este script no puede ejecutarse en produccion sin ALLOW_PRODUCTION_TEST_PASSWORD_RESET=true.',
    );
  }
}

function assertValidEmail(email: string) {
  if (!email) {
    throw new Error('TEST_USER_EMAIL es obligatorio.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('TEST_USER_EMAIL debe tener un formato valido.');
  }
}

function assertValidPassword(password: string) {
  if (!password) {
    throw new Error('TEST_USER_PASSWORD es obligatorio.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `TEST_USER_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }
}

function maskEmail(email: string) {
  const [localPart, domain = ''] = email.split('@');
  const visible = localPart.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(localPart.length - 2, 3))}@${domain}`;
}

async function main() {
  assertSafeEnvironment();

  const email = getRequiredInput('email', 'TEST_USER_EMAIL').toLowerCase();
  const password = getRequiredInput('password', 'TEST_USER_PASSWORD');

  assertValidEmail(email);
  assertValidPassword(password);

  const user = await prisma.user.findUnique({
    where: { correo: email },
    select: {
      id: true,
      correo: true,
      password: true,
      organizacionId: true,
    },
  });

  if (!user) {
    throw new Error('Usuario no encontrado.');
  }

  const previousPasswordHash = user.password;
  const nextPasswordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: nextPasswordHash },
    select: { id: true },
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      correo: true,
      password: true,
      organizacionId: true,
    },
  });

  if (!updatedUser?.password) {
    throw new Error('No se pudo confirmar la actualizacion de password.');
  }

  console.log(
    JSON.stringify(
      {
        usuarioEncontrado: true,
        correo: maskEmail(updatedUser.correo),
        passwordActualizada: true,
        hashCambioConfirmado: previousPasswordHash !== updatedUser.password,
        organizacionPreservada:
          updatedUser.organizacionId === user.organizacionId,
        operacionExitosa: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          operacionExitosa: false,
          message:
            error instanceof Error
              ? error.message
              : 'Error desconocido al restablecer password.',
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

