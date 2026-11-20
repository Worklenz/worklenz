#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
cat > "$test_dir/openssl.cnf" <<'EOF'
[ req ]
distinguished_name = dn
[ dn ]
EOF
export OPENSSL_CONF="$test_dir/openssl.cnf"
openssl_path=$(command -v openssl)
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
# Simulate Docker forwarding stdin: file-based commands must not consume menu input.
(
    command() {
        if [[ "$1" == -v && "$2" == openssl ]]; then return 1; fi
        builtin command "$@"
    }
    docker() {
        shift 5 # run --rm -i -v mount
        shift # image
        if [[ "$1" != pkey || " ${*} " != *' -pubin '* ]]; then
            cat >/dev/null
        fi
        "$openssl_path" "$@"
    }
    setup_self_signed_ssl >/dev/null
    IFS= read -r remaining_input
    [[ "$remaining_input" == 'menu input' ]]
) <<< 'menu input'
cp "$SSL_DIR/key.pem" "$test_dir/localhost-key.pem"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$SSL_DIR/key.pem" >/dev/null 2>&1
invalid_key=$(sha256sum "$SSL_DIR/key.pem")
if setup_self_signed_ssl >/dev/null; then
    echo 'A mismatched localhost key was accepted' >&2
    exit 1
fi

# A validation failure in the interactive menu must not exit the shell.
(
    print_header() { :; }
    manage_ssl <<< $'1\n\n' >/dev/null
    printf 'menu returned\n'
) | grep -q 'menu returned'

# Generation failures must propagate even when called from a conditional.
(
    SSL_DIR="$test_dir/generation-failure"
    openssl() {
        while [ "$#" -gt 0 ]; do
            case "$1" in
                -keyout|-out) touch "$2"; shift 2 ;;
                *) shift ;;
            esac
        done
        return 1
    }
    if setup_self_signed_ssl >/dev/null; then
        echo 'Certificate generation failure was reported as success' >&2
        exit 1
    fi
    [[ ! -e "$SSL_DIR/key.pem" && ! -e "$SSL_DIR/cert.pem" ]]
    [[ -z "$(ls -A "$SSL_DIR")" ]]
)
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
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" \
    -subj '/CN=localhost' -addext 'subjectAltName=IP:127.0.0.1' >/dev/null 2>&1
if setup_self_signed_ssl >/dev/null; then
    echo 'A localhost certificate without a DNS subject alternative name was accepted' >&2
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

# The same EC public key may use different point encodings in the two files.
openssl ecparam -genkey -name prime256v1 -noout -out "$SSL_DIR/key.pem"
openssl req -new -x509 -key "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" -days 1 \
    -subj '/CN=example.com' -addext 'subjectAltName=DNS:example.com' >/dev/null 2>&1
openssl ec -in "$SSL_DIR/key.pem" -conv_form compressed -out "$test_dir/ec-key.pem" 2>/dev/null
cp "$test_dir/ec-key.pem" "$SSL_DIR/key.pem"
require_domain_certificate >/dev/null

# A link outside the nginx bind mount must never pass validation.
cp "$SSL_DIR/cert.pem" "$test_dir/external-cert.pem"
rm "$SSL_DIR/cert.pem"
ln -s "$test_dir/external-cert.pem" "$SSL_DIR/cert.pem"
if require_domain_certificate >/dev/null; then
    echo 'An externally linked certificate was accepted' >&2
    exit 1
fi
rm "$SSL_DIR/cert.pem"
cp "$test_dir/external-cert.pem" "$SSL_DIR/cert.pem"

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
(
    SSL_DIR="$test_dir/dangling-link"
    mkdir "$SSL_DIR"
    ln -s "$test_dir/missing-cert.pem" "$SSL_DIR/cert.pem"
    if setup_self_signed_ssl >/dev/null; then
        echo 'A broken certificate symlink was accepted' >&2
        exit 1
    fi
    [[ -L "$SSL_DIR/cert.pem" && ! -e "$SSL_DIR/key.pem" && ! -e "$test_dir/missing-cert.pem" ]]
)

# Wildcard bind addresses are not usable URLs; the installer advertises localhost.
ENV_FILE="$test_dir/.env"
cp "$repo_dir/.env.example" "$ENV_FILE"
sed -i 's/^DOMAIN=.*/DOMAIN=0.0.0.0/' "$ENV_FILE"
sed -i 's|^VITE_API_URL=.*|VITE_API_URL=https://0.0.0.0|; s|^FRONTEND_URL=.*|FRONTEND_URL=https://0.0.0.0|' "$ENV_FILE"
auto_configure_env >/dev/null
grep -qx 'VITE_API_URL=https://localhost' "$ENV_FILE"
grep -qx 'FRONTEND_URL=https://localhost' "$ENV_FILE"
sed -i 's/^DOMAIN=.*/DOMAIN=127.0.0.1/' "$ENV_FILE"
auto_configure_env >/dev/null
grep -qx 'FRONTEND_URL=https://127.0.0.1' "$ENV_FILE"
grep -qx 'SERVER_CORS=https://127.0.0.1' "$ENV_FILE"
grep -qx 'SOCKET_IO_CORS=https://127.0.0.1' "$ENV_FILE"
if setup_letsencrypt_ssl >/dev/null; then
    echo 'Unsupported automatic certificate issuance was reported as successful' >&2
    exit 1
fi
printf '%s\n' 'SSL setup checks passed'
