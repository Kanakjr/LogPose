FROM node:20-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apk add --no-cache libc6-compat
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund --prefer-offline 2>/dev/null \
 || npm install --legacy-peer-deps --no-audit --no-fund

FROM base AS builder
ENV NODE_OPTIONS="--max-old-space-size=3072"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
