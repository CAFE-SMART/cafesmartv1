FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN npx prisma generate
RUN pnpm run build
EXPOSE 3000
CMD ["pnpm", "run", "start:prod"]
