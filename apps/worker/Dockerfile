FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @leni/db db:generate
RUN pnpm --filter @leni/worker build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3001
CMD ["sh", "-c", "cd packages/db && npx prisma db push --skip-generate && npx tsx prisma/seed.ts && cd /app && node apps/worker/dist/index.js"]
