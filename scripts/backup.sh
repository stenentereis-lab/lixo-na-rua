#!/usr/bin/env bash
#
# Backup diário do banco de produção.
#
# Instalar no servidor:
#   chmod +x ~/lixo-na-rua/scripts/backup.sh
#   mkdir -p ~/backups
#   crontab -e
#   0 3 * * * /home/lixo/lixo-na-rua/scripts/backup.sh >> /home/lixo/backups/backup.log 2>&1
#
# As fotos ficam no R2, que tem durabilidade própria. Este backup cobre o
# banco, que é o único dado que existe apenas neste servidor.

set -euo pipefail

PROJETO="/home/lixo/lixo-na-rua"
DESTINO="/home/lixo/backups"
DIAS_MANTER=30

cd "$PROJETO"

# Lê DB_USER e DB_NAME do .env.prod sem expor os demais valores.
DB_USER=$(grep '^DB_USER=' .env.prod | cut -d= -f2-)
DB_NAME=$(grep '^DB_NAME=' .env.prod | cut -d= -f2-)

mkdir -p "$DESTINO"

ARQUIVO="$DESTINO/db-$(date +%F-%H%M).sql.gz"

echo "[$(date '+%F %T')] iniciando backup"

# -T desativa o pseudo-terminal: sem isso o cron falha, porque não há TTY.
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$ARQUIVO"

# pg_dump que falha no meio deixa um .gz pequeno e aparentemente válido.
# Um dump real deste projeto passa de 1 KB mesmo com o banco quase vazio.
TAMANHO=$(stat -c%s "$ARQUIVO")
if [ "$TAMANHO" -lt 1000 ]; then
  echo "[$(date '+%F %T')] ERRO: backup com apenas ${TAMANHO} bytes — descartado"
  rm -f "$ARQUIVO"
  exit 1
fi

echo "[$(date '+%F %T')] ok: $ARQUIVO (${TAMANHO} bytes)"

# Remove backups antigos.
find "$DESTINO" -name 'db-*.sql.gz' -mtime "+$DIAS_MANTER" -delete

echo "[$(date '+%F %T')] backups mantidos: $(find "$DESTINO" -name 'db-*.sql.gz' | wc -l)"
