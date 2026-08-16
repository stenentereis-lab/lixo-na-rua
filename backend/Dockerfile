# Imagem de produção do backend.
#
# Multi-stage: a etapa de build instala tudo (inclusive devDependencies,
# necessárias para rodar os testes), e a imagem final leva só o que o
# runtime precisa.

# ---------- etapa 1: dependências ----------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

# `npm ci` usa o package-lock.json e falha se ele estiver dessincronizado —
# é o que garante que a imagem tenha exatamente as versões testadas.
RUN npm ci --omit=dev

# ---------- etapa 2: runtime ----------
FROM node:20-alpine AS runtime

# dumb-init faz o PID 1 repassar sinais corretamente. Sem ele, o
# SIGTERM do orquestrador não chega ao Node e o encerramento limpo
# implementado em src/index.js nunca roda.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# Usuário sem privilégios: o node:alpine já traz o usuário `node`.
# Rodar como root dentro do container amplia o estrago de qualquer falha.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts ./scripts

# Só é usado com STORAGE_DRIVER=local. Em produção use S3 — este diretório
# desaparece a cada deploy.
RUN mkdir -p uploads && chown node:node uploads

USER node

EXPOSE 3000

# O /health consulta o banco, então este check cobre API e banco de uma vez.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
