FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN npx prisma generate
RUN pnpm run build
EXPOSE 3000
CMD ["pnpm", "run", "start:prod"]