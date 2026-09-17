FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY packages/store-domain ./packages/store-domain
COPY services/api-store-platform/package.json services/api-store-platform/package-lock.json ./services/api-store-platform/
WORKDIR /app/services/api-store-platform
RUN npm ci
COPY services/api-store-platform ./
COPY packages/store-domain /app/packages/store-domain
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY services/api-store-platform/package.json services/api-store-platform/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/services/api-store-platform/dist ./dist
COPY services/api-store-platform/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chown -R node:node /app && chmod +x /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 3001
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
