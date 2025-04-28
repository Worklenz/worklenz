FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Create env-config.js dynamically during build
RUN echo "window.VITE_API_URL='${VITE_API_URL:-http://backend:3000}';" > ./public/env-config.js && \
    echo "window.VITE_SOCKET_URL='${VITE_SOCKET_URL:-ws://backend:3000}';" >> ./public/env-config.js

RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/build /app/build
COPY --from=build /app/public/env-config.js /app/build/env-config.js

# Create start.sh script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo '# Update env-config.js with runtime environment variables' >> /app/start.sh && \
    echo 'cat > /app/build/env-config.js << EOL' >> /app/start.sh && \
    echo 'window.VITE_API_URL="${VITE_API_URL:-http://backend:3000}";' >> /app/start.sh && \
    echo 'window.VITE_SOCKET_URL="${VITE_SOCKET_URL:-ws://backend:3000}";' >> /app/start.sh && \
    echo 'EOL' >> /app/start.sh && \
    echo 'exec serve -s build -l 5000' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 5000
CMD ["/app/start.sh"]