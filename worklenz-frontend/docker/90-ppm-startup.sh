#!/bin/sh
set -e

LISTEN_PORT="${PORT:-5000}"
BACKEND="${BACKEND_URL:-http://localhost:3000}"

# Read DNS resolver from /etc/resolv.conf (Railway uses fd12::10)
DNS_RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf 2>/dev/null || echo "8.8.8.8")

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

# When proxy_pass uses a variable, nginx does NOT do path substitution —
# the full original request URI is forwarded as-is, which is what we want.
# The variable forces nginx to re-resolve DNS on each request.
cat > /etc/nginx/conf.d/default.conf <<EOF
resolver [${DNS_RESOLVER}] valid=10s;

server {
    listen ${LISTEN_PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    set \$backend ${BACKEND};

    location /api/ {
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /secure/ {
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /csrf-token {
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /ppm/ {
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
    }

    location /public/ {
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /socket {
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Cookie \$http_cookie;
        proxy_pass_header Set-Cookie;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }

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

echo "PPM: nginx on :${LISTEN_PORT} -> ${BACKEND} (resolver: ${DNS_RESOLVER})"
