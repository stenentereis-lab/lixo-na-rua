#!/usr/bin/env bash
#
# Restaura um backup do banco.
#
#   ./scripts/restaurar.sh /home/lixo/backups/db-2026-08-16-0300.sql.gz
#
# ⚠️ SUBSTITUI os dados atuais. Antes de rodar em produção, teste num banco
# descartável — backup que nunca foi restaurado não é backup, é esperança.

set -euo pipefail

ARQUIVO="${1:-}"

if [ -z "$ARQUIVO" ] || [ ! -f "$ARQUIVO" ]; then
  echo "Uso: $0 <arquivo.sql.gz>"
  echo ""
  echo "Backups disponíveis:"
  ls -lh /home/lixo/backups/db-*.sql.gz 2>/dev/null || echo "  (nenhum)"
  exit 1
fi

if ! gzip -t "$ARQUIVO"; then
  echo "ERRO: o arquivo não é um gzip íntegro: $ARQUIVO"
  exit 1
fi

PROJETO="${PROJETO:-/home/lixo/lixo-na-rua}"
cd "$PROJETO"

DB_USER=$(grep '^DB_USER=' .env.prod | cut -d= -f2-)
DB_NAME=$(grep '^DB_NAME=' .env.prod | cut -d= -f2-)

if [[ ! "$DB_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] ||
   [[ ! "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "ERRO: DB_USER ou DB_NAME contém caracteres inválidos."
  exit 1
fi

if [ "$DB_NAME" = "postgres" ]; then
  echo "ERRO: DB_NAME=postgres não é permitido para restauração."
  exit 1
fi

SUFIXO=$(date +%s)
DB_TEMP="${DB_NAME}_restore_${SUFIXO}"
DB_ANTIGO="${DB_NAME}_antes_${SUFIXO}"

compose() {
  docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"
}

psql_admin() {
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres "$@"
}

limpar_temporario() {
  compose exec -T postgres dropdb -U "$DB_USER" --if-exists "$DB_TEMP" >/dev/null 2>&1 || true
}

backend_saudavel() {
  local _
  for _ in {1..15}; do
    if compose exec -T backend node -e \
      "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) })" \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

recolocar_banco_anterior() {
  compose stop backend >/dev/null 2>&1 || true
  psql_admin -v atual="$DB_NAME" -v antigo="$DB_ANTIGO" -v novo="$DB_TEMP" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN (:'atual', :'antigo') AND pid <> pg_backend_pid();

ALTER DATABASE :"atual" RENAME TO :"novo";
ALTER DATABASE :"antigo" RENAME TO :"atual";
SQL
  compose start backend || true
}

trap limpar_temporario EXIT

echo "Isto vai SUBSTITUIR o conteúdo de '$DB_NAME' pelo backup:"
echo "  $ARQUIVO"
echo ""
read -rp "Digite 'confirmo' para prosseguir: " RESPOSTA

if [ "$RESPOSTA" != "confirmo" ]; then
  echo "Cancelado."
  exit 1
fi

echo "Validando o backup em um banco temporário..."
compose exec -T postgres createdb -U "$DB_USER" -T template0 -O "$DB_USER" "$DB_TEMP"
gunzip -c "$ARQUIVO" | compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_TEMP"

echo "Backup validado. Parando o backend para trocar os bancos..."
compose stop backend

if ! psql_admin -v atual="$DB_NAME" -v antigo="$DB_ANTIGO" -v novo="$DB_TEMP" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN (:'atual', :'novo') AND pid <> pg_backend_pid();

ALTER DATABASE :"atual" RENAME TO :"antigo";
ALTER DATABASE :"novo" RENAME TO :"atual";
SQL
then
  echo "ERRO: não foi possível trocar os bancos. Tentando recuperar o anterior..."
  BANCO_ATUAL_EXISTE=$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = :'nome'" \
    -v nome="$DB_NAME" | tr -d '[:space:]')
  BANCO_ANTIGO_EXISTE=$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = :'nome'" \
    -v nome="$DB_ANTIGO" | tr -d '[:space:]')
  if [ -z "$BANCO_ATUAL_EXISTE" ] && [ "$BANCO_ANTIGO_EXISTE" = "1" ]; then
    psql_admin -v atual="$DB_NAME" -v antigo="$DB_ANTIGO" \
      -c 'ALTER DATABASE :"antigo" RENAME TO :"atual";'
  fi
  compose start backend || true
  exit 1
fi

echo "Subindo o backend..."
compose start backend
if ! backend_saudavel; then
  echo "ERRO: o backend não ficou saudável. Restaurando o banco anterior..."
  recolocar_banco_anterior
  exit 1
fi

echo "Removendo o banco anterior após a troca bem-sucedida..."
compose exec -T postgres dropdb -U "$DB_USER" --if-exists "$DB_ANTIGO"
trap - EXIT

echo "Pronto. Confira: curl https://api-lixo.brconsultorias.com/health"
