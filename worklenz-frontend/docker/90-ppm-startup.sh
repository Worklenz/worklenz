#!/bin/sh
set -e

LISTEN_PORT="${PORT:-5000}"
BACKEND="${BACKEND_URL:-http://localhost:3000}"

cat > /usr/share/nginx/html/env-config.js <<EOF
window.VITE_API_URL = "";
window.VITE_SOCKET_URL = "";
window.VITE_APP_TITLE = "${VITE_APP_TITLE:-PPM TaskFlow}";
window.VITE_APP_ENV = "${VITE_APP_ENV:-production}";
window.VITE_ENABLE_RECAPTCHA = "${VITE_ENABLE_RECAPTCHA:-false}";
window.VITE_RECAPTCHA_SITE_KEY = "${VITE_RECAPTCHA_SITE_KEY:-}";
window.VITE_ENABLE_GOOGLE_LOGIN = "${VITE_ENABLE_GOOGLE_LOGIN:-false}";
window.VITE_ENABLE_SURVEY_MODAL = "${VITE_ENABLE_SURVEY_MODAL:-false}";
EOF

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen ${LISTEN_PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass ${BACKEND}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /secure/ {
        proxy_pass ${BACKEND}/secure/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /csrf-token {
        proxy_pass ${BACKEND}/csrf-token;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /ppm/ {
        proxy_pass ${BACKEND}/ppm/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /public/ {
        proxy_pass ${BACKEND}/public/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /socket {
        proxy_pass ${BACKEND}/socket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # Never cache env-config.js or index.html (runtime config + SPA entry)
    location = /env-config.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

echo "PPM: nginx on :${LISTEN_PORT} -> ${BACKEND}"
echo "PPM: resolv.conf contents:"
cat /etc/resolv.conf
echo "PPM: end resolv.conf"
