FROM node:20-bookworm-slim AS build

RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci

COPY apps/api apps/api
COPY apps/web apps/web
COPY data data

RUN npm run build

FROM node:20-bookworm-slim AS run

RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/

RUN npm ci --omit=dev -w @russia-game/api

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY data ./data

VOLUME ["/app/data"]

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
