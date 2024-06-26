# STAGE 1: build
FROM node:18-alpine3.20 as base

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN npm install -g @angular/cli

RUN npm install

CMD ["npm", "run", "start-docker"]

# STAGE 2: Use compiled app for production with nginx