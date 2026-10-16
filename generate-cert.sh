#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$DIR/certs"
mkdir -p "$CERTS_DIR"

KEY_FILE="$CERTS_DIR/key.pem"
CERT_FILE="$CERTS_DIR/cert.pem"

if [ -f "$KEY_FILE" ] && [ -f "$CERT_FILE" ]; then
  echo "TLS certificates already exist in certs/"
  exit 0
fi

echo "Generating self-signed certificate for local development and LAN testing..."

# Get local IP addresses for SAN
LOCAL_IPS=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' || true)
SAN_ENTRIES="DNS:localhost,IP:127.0.0.1"
i=1
for ip in $LOCAL_IPS; do
  SAN_ENTRIES="$SAN_ENTRIES,IP:$ip"
done

openssl req -x509 -newkey rsa:2048 -nodes -sha256 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days 365 \
  -subj "/CN=RedGreen Game/O=SquidGame/C=US" \
  -addext "subjectAltName=$SAN_ENTRIES" 2>/dev/null || \
openssl req -x509 -newkey rsa:2048 -nodes -sha256 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days 365 \
  -subj "/CN=RedGreen Game"

echo "Certificates generated successfully in $CERTS_DIR"
