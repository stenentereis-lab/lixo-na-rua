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

cd /home/lixo/lixo-na-rua

DB_USER=$(grep '^DB_USER=' .env.prod | cut -d= -f2-)
DB_NAME=$(grep '^DB_NAME=' .env.prod | cut -d= -f2-)

echo "Isto vai SUBSTITUIR o conteúdo de '$DB_NAME' pelo backup:"
echo "  $ARQUIVO"
echo ""
read -rp "Digite 'confirmo' para prosseguir: " RESPOSTA

if [ "$RESPOSTA" != "confirmo" ]; then
  echo "Cancelado."
  exit 1
fi

echo "Parando o backend para ninguém escrever durante a restauração..."
docker compose -f docker-compose.prod.yml --env-file .env.prod stop backend

echo "Restaurando..."
gunzip -c "$ARQUIVO" | docker compose -f docker-compose.prod.yml \
  --env-file .env.prod exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"

echo "Subindo o backend..."
docker compose -f docker-compose.prod.yml --env-file .env.prod start backend

echo "Pronto. Confira: curl https://api-lixo.brconsultorias.com/health"
