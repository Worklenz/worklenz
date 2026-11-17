#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
# Source the functions without starting the interactive CLI.
source "$repo_dir/manage.sh"
SSL_DIR="$test_dir/ssl"
DOMAIN=localhost

setup_self_signed_ssl >/dev/null
openssl x509 -in "$SSL_DIR/cert.pem" -noout -checkhost localhost | grep -q 'does match'
openssl x509 -in "$SSL_DIR/cert.pem" -noout -checkip 127.0.0.1 | grep -q 'does match'
original_cert=$(sha256sum "$SSL_DIR/cert.pem")
original_key=$(sha256sum "$SSL_DIR/key.pem")
setup_self_signed_ssl >/dev/null
[[ "$original_cert" == "$(sha256sum "$SSL_DIR/cert.pem")" ]]
[[ "$original_key" == "$(sha256sum "$SSL_DIR/key.pem")" ]]

DOMAIN=example.com
if require_domain_certificate >/dev/null; then
    echo 'A localhost certificate was accepted for a production domain' >&2
    exit 1
fi
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" \
    -subj '/CN=example.com' -addext 'subjectAltName=DNS:example.com' >/dev/null 2>&1
require_domain_certificate >/dev/null
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$SSL_DIR/key.pem" >/dev/null 2>&1
if require_domain_certificate >/dev/null; then
    echo 'A mismatched production key was accepted' >&2
    exit 1
fi
original_cert=$(sha256sum "$SSL_DIR/cert.pem")
rm "$SSL_DIR/key.pem"
if require_domain_certificate >/dev/null; then
    echo 'Missing production key was accepted' >&2
    exit 1
fi
if setup_self_signed_ssl >/dev/null; then
    echo 'An incomplete certificate pair was overwritten' >&2
    exit 1
fi
[[ "$original_cert" == "$(sha256sum "$SSL_DIR/cert.pem")" ]]
if setup_letsencrypt_ssl >/dev/null; then
    echo 'Unsupported automatic certificate issuance was reported as successful' >&2
    exit 1
fi
printf '%s\n' 'SSL setup checks passed'
