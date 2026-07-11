const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.startsWith('pnpm/')) {
  console.error('Cafe Smart usa exclusivamente pnpm.');
  console.error('Ejecuta: corepack enable && corepack prepare pnpm@10.33.0 --activate');
  console.error('Luego usa: pnpm install');
  process.exit(1);
}