FROM node:24-bookworm-slim AS source
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY apps ./apps
COPY packages ./packages
COPY examples ./examples
COPY scripts ./scripts
COPY migrations ./migrations
COPY tsconfig.json ./

FROM source AS replay-build
RUN npm run replay:build
FROM nginx:1.28-alpine AS public-replay
COPY --from=replay-build /app/apps/replay/dist /usr/share/nginx/html
COPY deploy/replay.nginx.conf /etc/nginx/conf.d/default.conf

FROM source AS console-build
RUN npm run web:build && REPLAY_BASE=/replay/ npm run replay:build
FROM nginx:1.28-alpine AS operator-console
COPY --from=console-build /app/apps/web/dist /usr/share/nginx/html
COPY --from=console-build /app/apps/replay/dist /usr/share/nginx/html/replay
COPY deploy/console.nginx.conf /etc/nginx/conf.d/default.conf

FROM source AS runtime
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "apps/gateway/src/server.ts"]
