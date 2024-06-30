# STAGE 1: build
FROM node:18-alpine3.20 as build

WORKDIR /usr/src/app
COPY . /usr/src/app
# RUN npm i -g @angular/cli
RUN npm install --silent
ARG configuration=production
RUN npm run build -- --output-path=/usr/src/app/dist/out --configuration $configuration

# STAGE 2: Use built app for production with nginx
FROM nginx:alpine3.19-slim
COPY --from=build /usr/src/app/dist/out/ /usr/share/nginx/html
COPY ./nginx/nginx-custom.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
CMD [ "nginx", "-g", "daemon off;" ]