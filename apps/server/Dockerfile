FROM node:22-alpine AS base

WORKDIR /repo

# Copiamos el monorepo (incluye apps/ y packages/)
COPY . .

RUN npm ci

# Aseguramos que core y server queden compilados a JS (dist)
RUN npm run build -w @gestor/core && npm run build -w @gestor/server

EXPOSE 4000

CMD ["npm", "run", "start", "-w", "@gestor/server"]

