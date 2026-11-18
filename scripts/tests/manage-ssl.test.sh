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
cp "$SSL_DIR/key.pem" "$test_dir/localhost-key.pem"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$SSL_DIR/key.pem" >/dev/null 2>&1
invalid_key=$(sha256sum "$SSL_DIR/key.pem")
if setup_self_signed_ssl >/dev/null; then
    echo 'A mismatched localhost key was accepted' >&2
    exit 1
fi
[[ "$original_cert" == "$(sha256sum "$SSL_DIR/cert.pem")" ]]
[[ "$invalid_key" == "$(sha256sum "$SSL_DIR/key.pem")" ]]
cp "$test_dir/localhost-key.pem" "$SSL_DIR/key.pem"

openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" \
    -subj '/CN=localhost' >/dev/null 2>&1
if setup_self_signed_ssl >/dev/null; then
    echo 'A localhost certificate without an IP subject alternative name was accepted' >&2
    exit 1
fi

DOMAIN=example.com
if require_domain_certificate >/dev/null; then
    echo 'A localhost certificate was accepted for a production domain' >&2
    exit 1
fi
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" \
    -subj '/CN=example.com' -addext 'subjectAltName=DNS:example.com' >/dev/null 2>&1
require_domain_certificate >/dev/null

# Sign a matching certificate whose validity period has not started yet.
mkdir "$test_dir/ca"
touch "$test_dir/ca/index.txt"
printf '01\n' > "$test_dir/ca/serial"
cat > "$test_dir/ca/openssl.cnf" <<EOF
[ ca ]
default_ca = local_ca
[ local_ca ]
database = $test_dir/ca/index.txt
new_certs_dir = $test_dir/ca
serial = $test_dir/ca/serial
default_md = sha256
policy = policy
copy_extensions = copy
[ policy ]
commonName = supplied
EOF
openssl req -new -key "$SSL_DIR/key.pem" -out "$test_dir/request.pem" \
    -subj '/CN=example.com' -addext 'subjectAltName=DNS:example.com' >/dev/null 2>&1
openssl ca -batch -selfsign -config "$test_dir/ca/openssl.cnf" \
    -keyfile "$SSL_DIR/key.pem" -in "$test_dir/request.pem" -out "$test_dir/future.pem" \
    -startdate 20990101000000Z -enddate 21000101000000Z >/dev/null 2>&1
cp "$SSL_DIR/cert.pem" "$test_dir/current.pem"
cp "$test_dir/future.pem" "$SSL_DIR/cert.pem"
if require_domain_certificate >/dev/null; then
    echo 'A not-yet-valid production certificate was accepted' >&2
    exit 1
fi
cp "$test_dir/current.pem" "$SSL_DIR/cert.pem"
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
