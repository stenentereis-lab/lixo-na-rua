# Deploy e produção

> Estado: **infraestrutura pronta, ainda não publicado.** Este documento
> descreve como publicar e o que verificar antes.

## Diferenças entre desenvolvimento e produção

| Item          | Desenvolvimento         | Produção                          |
| ------------- | ----------------------- | --------------------------------- |
| Backend       | `nodemon` no host       | container, `node src/index.js`    |
| Fotos         | disco local             | S3 ou compatível                  |
| Postgres      | porta 5432 exposta      | só na rede interna do compose     |
| `JWT_SECRET`  | valor de exemplo        | aleatório, longo, secreto         |
| `CORS_ORIGIN` | `localhost:3001`        | domínio real                      |
| Reinício      | manual                  | `unless-stopped`                  |

## 1. Armazenamento das fotos

**Este é o passo que não dá para pular.** Com `STORAGE_DRIVER=local`, as
fotos ficam no disco do container e **somem a cada deploy** — o backend
avisa no boot se detectar essa combinação.

O código já suporta S3 e qualquer serviço compatível. A escolha do
provedor é sua:

| Provedor              | Custo de saída | Observação                              |
| --------------------- | -------------- | --------------------------------------- |
| **Cloudflare R2**     | **zero**       | 10 GB grátis; boa opção para app cívico |
| **Backblaze B2**      | baixo          | 10 GB grátis                            |
| DigitalOcean Spaces   | incluso        | preço fixo mensal                       |
| AWS S3                | **cobrado**    | saída pode surpreender com tráfego alto |

Tráfego de saída é o que pesa num app cheio de fotos. Por isso R2 e B2
aparecem primeiro.

Depois de criar o bucket, preencha em `.env.prod`:

```ini
STORAGE_DRIVER=s3
S3_BUCKET=lixo-na-rua-fotos
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://fotos.lixonarua.org
```

`S3_ENDPOINT` vazio significa AWS S3. Preenchido, aponta para o
compatível. O backend recusa subir se faltar credencial — falha no boot é
melhor que descobrir no primeiro upload de um usuário real.

### Migrar as fotos que já existem

Se já houver denúncias com fotos em disco, copie os arquivos de
`backend/uploads/` para o bucket **antes** de trocar o driver, mantendo os
mesmos nomes. As URLs gravadas no banco (`/uploads/<uuid>.jpg`) precisarão
ser reescritas para o novo prefixo — quanto mais cedo isso for feito,
menos linhas para atualizar.

## 2. Segredos

```powershell
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

O backend **recusa subir em produção** se o `JWT_SECRET` ainda for o valor
de desenvolvimento. Trocar o segredo invalida todas as sessões: os
usuários precisarão entrar de novo.

Senha do banco: longa, aleatória, diferente da de desenvolvimento.

Nada disso vai para o repositório. `.env` e `.env.prod` estão no
`.gitignore`; confirme com `git check-ignore .env.prod`.

## 3. Publicar

```bash
cp .env.prod.example .env.prod    # e preencha
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# criar as tabelas na primeira vez
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec backend npm run migrate

# conferir
curl https://api.seu-dominio.org/health
```

### Primeiro administrador

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec backend npm run set-role -- voce@exemplo.com admin
```

## 4. HTTPS

O compose expõe HTTP na porta 3000. **Não publique assim.** Sem TLS, a
senha e o token trafegam em texto puro.

Coloque um proxy reverso na frente — Caddy, Nginx com certbot, ou o
balanceador do provedor. O Caddy resolve certificado sozinho:

```
api.lixonarua.org {
    reverse_proxy localhost:3000
}
```

Depois disso, `CORS_ORIGIN` deve listar apenas origens `https://`.

## 5. Backup

O volume `postgres_data` guarda tudo. Sem backup, um `docker compose down
-v` apaga a base inteira sem confirmação.

```bash
# diário, via cron
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > backup-$(date +%F).sql.gz
```

Backup que nunca foi restaurado não é backup. Teste a restauração antes de
precisar dela.

## Checklist antes de publicar

```
[ ] JWT_SECRET aleatorio, diferente do de desenvolvimento
[ ] Senha do banco longa e exclusiva
[ ] STORAGE_DRIVER=s3 com bucket criado e credenciais testadas
[ ] CORS_ORIGIN com o dominio real, so https
[ ] HTTPS configurado no proxy reverso
[ ] Postgres sem porta exposta para a internet
[ ] npm test e npm run test:integration passando
[ ] Migrations aplicadas
[ ] Backup automatizado e restauracao testada
[ ] Primeiro admin promovido
[ ] .env.prod fora do git (git check-ignore .env.prod)
```

## Monitoramento

`GET /health` responde:

- **200** com `"database": "connected"` — tudo de pé
- **503** com `"database": "unavailable"` — API no ar, banco fora

Os dois códigos distintos permitem que o monitoramento diferencie
"aplicação caiu" de "banco caiu". O `HEALTHCHECK` do Dockerfile já usa
esse endpoint.

## Publicar o app mobile

### Chave do Google Maps (Android)

O mapa do app funciona **no Expo Go sem configuração**, porque o próprio
Expo Go traz a chave do Google. Numa build própria para Android, o mapa
aparece **cinza e vazio** sem uma chave sua.

1. No Google Cloud Console, ative a **Maps SDK for Android**
2. Crie uma chave de API e restrinja ao pacote `com.lixonarua.app`
3. Adicione em `mobile/app.json`:

```json
"android": {
  "config": {
    "googleMaps": { "apiKey": "SUA_CHAVE" }
  }
}
```

No iOS o mapa usa o Apple Maps, que não exige chave.

> A chave fica no `app.json`, que é versionado. Restrinja-a ao pacote do
> app no console do Google — sem restrição, qualquer um pode usá-la e a
> cobrança vem para você.

### Build

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

A URL da API precisa apontar para produção: em build, `hostUri` não
existe, então defina em `app.json`:

```json
"extra": { "apiUrl": "https://api.lixonarua.org" }
```

## Dívidas conhecidas

| Item                     | Impacto                                                      | Onde       |
| ------------------------ | ------------------------------------------------------------ | ---------- |
| Rate limit em memória    | Com 2+ instâncias o limite se multiplica. Migrar para Redis. | DECISOES #008 |
| Sem refresh token        | Sessão de 7 dias; expirou, login de novo.                    | —          |
| Sem rotação de logs      | Log vai para stdout; depende do coletor do provedor.          | —          |

## Ver também

- [SETUP.md](SETUP.md) — ambiente de desenvolvimento
- [ARQUITETURA.md](ARQUITETURA.md) — como o sistema é organizado
- [DECISOES.md](DECISOES.md) — por que as escolhas foram feitas
