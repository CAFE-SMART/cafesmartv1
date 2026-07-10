FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN pnpm exec prisma generate
RUN pnpm build
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start:prod"]