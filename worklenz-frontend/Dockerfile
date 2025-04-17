FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS production

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/build /app/build
EXPOSE 5000
CMD ["serve", "-s", "build", "-l", "5000"]