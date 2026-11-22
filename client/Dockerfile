# Built from the repo root (see docker-compose.yml) so it can use the monorepo's single lockfile.

# Stage 1: build the static site
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace=client --no-audit --no-fund
COPY client client
RUN npm run build --workspace=client

# Stage 2: serve it with nginx, which also proxies /api to the server
FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
