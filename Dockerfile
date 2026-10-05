# Builds the results page (site/) and serves the prerendered HTML with Caddy.
# The benchmark harness itself is not in the image: it needs API keys and the bills.
FROM node:22-alpine AS build
WORKDIR /site
COPY site/package.json site/package-lock.json ./
RUN npm ci
COPY site/ ./
RUN npm run build

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /site/build /srv
EXPOSE 8080
