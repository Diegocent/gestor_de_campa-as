FROM node:22-alpine AS build

WORKDIR /repo
COPY . .

RUN npm ci
RUN npm run build -w @gestor/web

FROM nginx:alpine AS runtime

# Config de SPA + proxy de API y socket.io hacia el backend
COPY docker/nginx.prod.conf /etc/nginx/conf.d/default.conf

# Vite build output
COPY --from=build /repo/apps/web/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

