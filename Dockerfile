# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa 1: build — compila la app Next.js con salida standalone.
# ---------------------------------------------------------------------------
FROM node:20.19.1-alpine3.21 AS build
WORKDIR /app

# Instalación reproducible a partir del lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Código fuente y build de producción.
COPY . .
# Variable opcional del andamiaje de colaboración (socket). Sin valor queda
# dormido; no se declaran GOOGLE_CLIENT_ID/SECRET ni AUTH_SECRET: el build
# funciona con todas ellas ausentes.
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2: runtime — imagen mínima no-root que sirve la salida standalone.
# ---------------------------------------------------------------------------
FROM node:20.19.1-alpine3.21 AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# La salida standalone trae server.js y un node_modules mínimo. Los estáticos
# con hash (.next/static) y public/ no van dentro de standalone: se copian aparte.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=5 \
  CMD ["node","-e","fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node","server.js"]
