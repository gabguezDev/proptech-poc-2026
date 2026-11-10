# syntax=docker/dockerfile:1
#
# Imagen del frontend Next.js (BFF incluido: los route handlers viven aquí).
#
#   node:22-alpine
#
# Dos etapas:
#   * dev     : `next dev` con el código montado por el compose. `node_modules`
#               y `.next` van en volúmenes para no pisarlos con el bind de macOS
#               (los binarios del host no sirven dentro del contenedor).
#   * prod    : `next build` + `next start`.

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------- DEPS ----------------------------
FROM base AS deps
# `package-lock.json` fija la versión exacta de Next/React del scaffold.
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------- DEV ----------------------------
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]

# ---------------------------- BUILD ----------------------------
FROM base AS build
ARG NEXT_PUBLIC_BACKEND_URL=""
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------- RUN ----------------------------
FROM base AS prod
ENV NODE_ENV=production
# El build de Next con `output: "standalone"` solo necesita lo esencial.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
