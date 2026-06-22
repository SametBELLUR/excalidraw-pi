#!/bin/sh
# Boot'ta OIDC issuer'in discovery ucu erisilebilir olana kadar bekle, sonra app'i baslat.
# Boylece anlik DNS/tunnel kesintisi OIDC'yi kalici olarak devre disi birakmaz.

ENV_FILE="/root/.env"
ISSUER=""
[ -f "$ENV_FILE" ] && ISSUER=$(grep -E '^OIDC_ISSUER_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\r"')

if [ -n "$ISSUER" ]; then
  DISC="${ISSUER%/}/.well-known/openid-configuration"
  echo "[entrypoint] OIDC issuer: $ISSUER"
  echo "[entrypoint] discovery bekleniyor: $DISC"
  i=0
  until curl -sf --max-time 5 -o /dev/null "$DISC"; do
    i=$((i + 1))
    echo "[entrypoint] erisilemiyor (deneme $i), 3 sn sonra tekrar..."
    sleep 3
  done
  echo "[entrypoint] discovery erisilebilir ($i deneme) — baslatiliyor."
else
  echo "[entrypoint] $ENV_FILE icinde OIDC_ISSUER_URL yok — beklemeden baslatiliyor."
fi

exec "$@"
