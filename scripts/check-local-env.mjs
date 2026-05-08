import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FRONTEND_ENV = path.join(ROOT, 'frontend', '.env');
const BACKEND_ENV = path.join(ROOT, 'backend', '.env');

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator === -1) {
          return [line, ''];
        }

        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');

        return [key, value];
      }),
  );
}

function hasPlaceholder(value) {
  return !value || /TU_|YOUR_|CHANGE_ME/i.test(value);
}

function fail(message) {
  console.error(`- ${message}`);
  process.exitCode = 1;
}

function isGoogleClientId(value) {
  return /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(value);
}

console.log('Revisando configuracion local...');

const frontend = readEnv(FRONTEND_ENV);
const backend = readEnv(BACKEND_ENV);

if (!frontend) {
  fail(
    'Falta frontend/.env. Copia frontend/.env.example y completa los valores.',
  );
}

if (!backend) {
  fail(
    'Falta backend/.env. Copia backend/.env.example y completa los valores.',
  );
}

if (!frontend || !backend) {
  process.exit();
}

const viteApiUrl = frontend.VITE_API_URL;
let parsedApiUrl = null;

try {
  parsedApiUrl = new URL(viteApiUrl);
} catch {
  fail('VITE_API_URL no es una URL valida. Ejemplo: http://localhost:3000');
}

if (
  parsedApiUrl &&
  parsedApiUrl.protocol !== 'http:' &&
  parsedApiUrl.protocol !== 'https:'
) {
  fail('VITE_API_URL debe empezar por http:// o https://.');
}

const backendPort = backend.PORT || '3000';
if (
  parsedApiUrl &&
  ['localhost', '127.0.0.1'].includes(parsedApiUrl.hostname) &&
  (parsedApiUrl.port || '80') !== backendPort
) {
  fail(
    `VITE_API_URL apunta al puerto ${parsedApiUrl.port || '80'}, pero backend PORT=${backendPort}.`,
  );
}

if (hasPlaceholder(frontend.VITE_GOOGLE_CLIENT_ID)) {
  fail('VITE_GOOGLE_CLIENT_ID no esta configurado con un Client ID real.');
} else if (!isGoogleClientId(frontend.VITE_GOOGLE_CLIENT_ID)) {
  fail('VITE_GOOGLE_CLIENT_ID no parece un Client ID valido de Google.');
}

const googleAudiences = (
  backend.GOOGLE_CLIENT_IDS ||
  backend.GOOGLE_CLIENT_ID ||
  ''
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (googleAudiences.length === 0 || googleAudiences.some(hasPlaceholder)) {
  fail(
    'GOOGLE_CLIENT_ID o GOOGLE_CLIENT_IDS no estan configurados con Client IDs reales.',
  );
} else if (!googleAudiences.includes(frontend.VITE_GOOGLE_CLIENT_ID)) {
  fail(
    'El VITE_GOOGLE_CLIENT_ID del frontend no esta incluido en GOOGLE_CLIENT_IDS del backend.',
  );
}

if (hasPlaceholder(backend.DATABASE_URL)) {
  fail('DATABASE_URL no esta configurada con una conexion real.');
}

if (hasPlaceholder(backend.DIRECT_URL)) {
  fail('DIRECT_URL no esta configurada con una conexion real.');
}

if (hasPlaceholder(backend.JWT_SECRET)) {
  fail('JWT_SECRET debe ser un secreto real, no el valor de ejemplo.');
}

if (process.exitCode) {
  console.error('\nCorrige esos puntos y vuelve a ejecutar pnpm dev.');
  process.exit();
}

console.log('Configuracion local OK.');
