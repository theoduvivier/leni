FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @leni/db db:generate
# Collect Prisma engine files into a known location before build
RUN mkdir -p /prisma-engine && \
    find /app/node_modules -name "libquery_engine-linux-musl*" -exec cp {} /prisma-engine/ \; && \
    find /app/node_modules -name "schema.prisma" -path "*/.prisma/client/*" -exec cp {} /prisma-engine/ \;
RUN pnpm --filter @leni/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# Copy Prisma query engine to all searched locations
COPY --from=builder /prisma-engine/ ./apps/web/.next/server/
COPY --from=builder /prisma-engine/ ./node_modules/.prisma/client/
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
