FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/build /app/build

# Create a script to inject environment variables
RUN echo '#!/bin/sh\n\
cat > /app/build/env.js << EOL\n\
window.env = {\n\
  VITE_API_URL: "${VITE_API_URL}"\n\
};\n\
EOL\n\
exec serve -s build -l 5000' > /app/start.sh && \
chmod +x /app/start.sh

EXPOSE 5000
CMD ["/app/start.sh"]