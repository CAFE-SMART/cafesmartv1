FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/only-allow-pnpm.mjs scripts/only-allow-pnpm.mjs
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --filter cafe-smart-backend...
COPY backend backend
WORKDIR /app/backend
RUN pnpm prisma:generate
RUN pnpm build
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma:migrate:deploy && pnpm start:prod"]
