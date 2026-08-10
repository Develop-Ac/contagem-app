# =============================================================================
# Sistema de Contagem — imagem de produção
# =============================================================================
#
# Build em três estágios para que a imagem final não carregue o `node_modules`
# de desenvolvimento nem o código-fonte:
#
#   deps     → instala as dependências a partir do lockfile
#   builder  → roda o `next build` (gera `.next/standalone`)
#   runner   → só o servidor autocontido, os estáticos e o `public/`
#
# ATENÇÃO ao endereço da API: `NEXT_PUBLIC_API_BASE_URL` é gravada dentro do
# bundle durante o build, não lida em tempo de execução. Ela precisa ser
# passada como *build arg*; mudar o endereço exige reconstruir a imagem.
#
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://api.exemplo -t contagem-app .
#   docker run -p 3000:3000 contagem-app
# =============================================================================


# -----------------------------------------------------------------------------
# 1. Dependências
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Copiar apenas os manifestos mantém esta camada em cache enquanto as
# dependências não mudarem.
COPY package.json package-lock.json ./

RUN npm ci


# -----------------------------------------------------------------------------
# 2. Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# URL base da API Estoque Service, sem barra final. Sem valor, o aplicativo cai
# na detecção por hostname definida em `lib/config.ts`.
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# -----------------------------------------------------------------------------
# 3. Execução
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Sem isto o servidor escuta apenas em localhost e o contêiner fica inacessível.
ENV HOSTNAME=0.0.0.0

# O servidor não precisa de privilégios: roda como usuário comum.
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

# `public/` traz o manifesto do PWA, o Service Worker, os ícones e os logotipos.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# `standalone` já contém o `server.js` e as dependências de execução.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
