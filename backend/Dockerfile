FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN npx prisma generate
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start:prod"]
