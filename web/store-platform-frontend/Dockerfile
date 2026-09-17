FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY packages/store-domain ./packages/store-domain
COPY web/store-platform-frontend/package.json web/store-platform-frontend/package-lock.json ./web/store-platform-frontend/
WORKDIR /app/web/store-platform-frontend
RUN npm ci
COPY web/store-platform-frontend ./
COPY packages/store-domain /app/packages/store-domain
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/web/store-platform-frontend/dist /usr/share/nginx/html
COPY web/store-platform-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
