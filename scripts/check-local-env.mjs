import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredPaths = [
  'backend',
  'frontend',
  'backend/package.json',
  'frontend/package.json',
  'backend/.env',
  'frontend/.env',
];

const missing = requiredPaths.filter((relativePath) => {
  return !existsSync(join(root, relativePath));
});

if (missing.length > 0) {
  console.error('Faltan archivos locales para iniciar Cafe Smart:');
  for (const relativePath of missing) {
    console.error(`- ${relativePath}`);
  }
  console.error('Copia los .env.example como .env y configura las variables.');
  process.exit(1);
}

console.log('Entorno local verificado.');
