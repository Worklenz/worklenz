FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Unlike worklenz-frontend, this app reads import.meta.env.VITE_API_BASE_URL directly
# (see src/services/api.ts, src/store/api.ts, src/utils/socket.ts) — there is no
# window.env-config.js runtime shim here, so the API base URL must be baked in at
# build time via this ARG rather than injected at container start.
ARG VITE_API_BASE_URL=http://backend:3000/api/client-portal
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist /app/dist

EXPOSE 5174
CMD ["serve", "-s", "dist", "-l", "5174"]
