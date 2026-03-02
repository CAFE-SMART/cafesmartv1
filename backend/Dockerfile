FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN npx prisma generate
RUN pnpm run build
EXPOSE 3000
CMD ["pnpm", "run", "start:prod"]