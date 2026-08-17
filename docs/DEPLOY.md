# Deploy — Cloudflare + VPS

> Estado: **no ar desde 16/08/2026.**
>
> | Peça | Endereço | Onde roda |
> | --- | --- | --- |
> | API | https://api-lixo.brconsultorias.com | VPS Hetzner CX23, Helsinki |
> | Site | https://lixonarua.brconsultorias.com | Cloudflare Pages |
> | Fotos | https://fotos-lixo.brconsultorias.com | Cloudflare R2 |
>
> Reserva do site: `lixo-na-rua.pages.dev`

## Arquitetura

```
                 ┌──────────────────────────────┐
   navegador ───▶│  Cloudflare Pages (web)      │
                 └──────────────┬───────────────┘
                                │ HTTPS
   celular ────────────────────▶│
                 ┌──────────────▼───────────────┐
                 │  Cloudflare Tunnel           │
                 └──────────────┬───────────────┘
                                │ conexão de dentro para fora
                 ┌──────────────▼───────────────┐
                 │  VPS (docker compose)        │
                 │   backend  ──▶  Postgres     │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────▼───────────────┐
                 │  Cloudflare R2 (fotos)       │
                 └──────────────────────────────┘
```

**O servidor não abre nenhuma porta para a internet.** O túnel conecta de
dentro para fora, então o firewall do VPS pode ficar fechado, com só o SSH
entrando. Isso elimina a maior superfície de ataque de um servidor exposto.

## Endereços

O projeto vive em subdomínios de um domínio já existente. O site atual
continua intocado.

| Endereço                          | Serviço            |
| --------------------------------- | ------------------ |
| `brconsultorias.com`              | site atual, intocado |
| `lixonarua.brconsultorias.com`    | web (Pages)        |
| `api-lixo.brconsultorias.com`     | backend (Tunnel)   |
| `fotos-lixo.brconsultorias.com`   | fotos (R2)         |

> ⚠️ **Um nível de subdomínio, sempre.** O certificado SSL gratuito da
> Cloudflare cobre o domínio e `*.brconsultorias.com`, mas **não** cobre
> dois níveis. `api.lixonarua.brconsultorias.com` daria erro de certificado
> no navegador, e corrigir exigiria o Advanced Certificate Manager, que é
> pago. Por isso `api-lixo` e não `api.lixonarua`.

## Custo estimado

| Item              | Serviço            | Custo                    |
| ----------------- | ------------------ | ------------------------ |
| Servidor          | VPS 2 vCPU / 4 GB  | ~€4–6 por mês            |
| Fotos             | Cloudflare R2      | 10 GB grátis, sem egress |
| Site              | Cloudflare Pages   | grátis                   |
| Túnel, DNS, SSL   | Cloudflare         | grátis                   |
| Domínio           | registro           | ~R$40 por ano            |

O R2 não cobra transferência de saída — é o que mais pesaria num app cheio
de fotos.

---

## 1. Fotos no R2

1. **R2** → *Create bucket* → nome `lixo-na-rua-fotos`
2. **Manage R2 API Tokens** → *Create API Token*
   - Permissão: **Object Read & Write** — nunca Admin. Admin permite
     excluir buckets inteiros; o backend só precisa gravar objetos.
   - Restrinja ao bucket criado
   - Guarde `Access Key ID` e `Secret Access Key` — o segredo só aparece uma vez

> **Crie o token no momento em que for preencher o `.env.prod`**, não antes.
> Assim o valor vai da tela direto para o arquivo, sem passar por print,
> mensagem ou área de transferência esquecida.
>
> Segredo que aparece em captura de tela deve ser considerado exposto e
> rotacionado — mesmo que a captura pareça ter ficado só com você. A
> alternativa é confiar que ninguém mais verá aquele arquivo, e isso não é
> uma garantia que se possa dar.
3. No bucket → **Settings** → **S3 API**: copie o endpoint
   (`https://<account-id>.r2.cloudflarestorage.com`)
4. Ainda em Settings → **Public access** → *Connect domain* →
   `fotos-lixo.brconsultorias.com`

Preencha no `.env.prod`:

```ini
STORAGE_DRIVER=s3
S3_BUCKET=lixo-na-rua-fotos
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://fotos-lixo.brconsultorias.com
```

> `S3_REGION=auto` é exigência do R2. O `S3_PUBLIC_URL` precisa do domínio
> conectado: sem ele, o bucket não serve os arquivos publicamente e as fotos
> não aparecem no app.
>
> ⚠️ **Substitua `<account-id>` pelo ID real.** Deixar o texto de exemplo é
> fácil e o efeito é traiçoeiro: o backend sobe, o login funciona, e só o
> upload falha — com erro 500 genérico, que não diz nada a quem está na rua
> tentando denunciar. Aconteceu aqui.
>
> Desde então o backend **recusa subir** com valores contendo `<` ou `>`,
> ou com endpoint que não seja URL válida. Se o container não iniciar,
> confira os logs: a mensagem diz exatamente qual variável está errada.

Confirme antes de subir:

```bash
grep -E "^S3_(ENDPOINT|PUBLIC_URL|BUCKET)=" .env.prod
```

Nenhum valor pode conter `<` ou `>`.

### Migrar as fotos que já existem

As denúncias criadas até agora têm imagens em `backend/uploads/` e URLs no
formato `/uploads/<uuid>.jpg`. Antes de trocar o driver:

1. Suba os arquivos para o bucket, mantendo o nome, sob o prefixo `denuncias/`
2. Atualize as URLs no banco:

```sql
UPDATE complaints
   SET image_url = 'denuncias/' || substring(image_url from '/uploads/(.*)')
 WHERE image_url LIKE '/uploads/%';
```

Faça isso enquanto são poucas linhas.

---

## 2. Servidor

Qualquer VPS com Docker serve — Hetzner, Contabo, DigitalOcean, Oracle Free.
Ubuntu 24.04 LTS.

```bash
# no servidor, como root
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh

# usuário sem privilégios para o app
adduser --disabled-password --gecos "" lixo
usermod -aG docker lixo

# firewall: só SSH entra. O túnel dispensa o resto.
ufw allow OpenSSH
ufw enable
```

```bash
# como o usuário lixo
su - lixo
git clone https://github.com/stenentereis-lab/lixo-na-rua.git
cd lixo-na-rua
cp .env.prod.example .env.prod
nano .env.prod          # preencha tudo
```

### Segredos

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" # DB_PASSWORD
```

O backend **recusa subir** se o `JWT_SECRET` ainda for o de desenvolvimento.
Trocar o segredo invalida as sessões existentes: todo mundo faz login de novo.

---

## 3. Túnel

1. **Zero Trust** → **Networks** → **Tunnels** → *Create a tunnel*
2. Tipo **Cloudflared**, nome `lixo-na-rua`
3. Copie o **token** e coloque em `CLOUDFLARE_TUNNEL_TOKEN` no `.env.prod`
4. Em **Public Hostnames**, adicione:

| Campo     | Valor                 |
| --------- | --------------------- |
| Subdomain | `api-lixo`            |
| Domain    | `brconsultorias.com`  |
| Service   | `http://backend:3000` |

> `backend` é o nome do serviço no compose, resolvido pela rede interna do
> Docker. Não use `localhost` — dentro do container do túnel, `localhost` é
> o próprio túnel.

---

## 4. Subir

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# criar as tabelas, só na primeira vez
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec backend npm run migrate

# conferir
curl https://api-lixo.brconsultorias.com/health
```

Esperado: `{"status":"OK","database":"connected",...}`

### Primeiro administrador

Cadastre-se pelo app e depois:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec backend npm run set-role -- voce@exemplo.com admin
```

---

## 5. Site no Pages

1. **Workers & Pages** → *Create* → **Pages** → conectar o repositório
2. Configuração de build:

| Campo                  | Valor           |
| ---------------------- | --------------- |
| Framework preset       | Vite            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Root directory         | `web`           |

3. **Environment variables** → `VITE_API_URL` = `https://api-lixo.brconsultorias.com`
4. **Custom domains** → `lixonarua.brconsultorias.com`

> ⚠️ Use o **subdomínio**, nunca `brconsultorias.com` sozinho. Apontar o
> Pages para o domínio raiz substituiria o site que já está no ar.

O deploy passa a ser automático a cada push na `main`.

> `_headers` e `_redirects` já estão em `web/public/` e são aplicados
> sozinhos pelo Pages. O `_redirects` faz qualquer caminho servir o
> `index.html`, senão recarregar numa rota interna daria 404.

Depois de publicar, ajuste o `CORS_ORIGIN` no `.env.prod` com o domínio real
e reinicie o backend.

---

## 6. App mobile

Já configurado em `mobile/app.config.js`:

```json
"extra": { "apiUrl": "https://api-lixo.brconsultorias.com" }
```

> **Como o app escolhe a URL:** em desenvolvimento (`__DEV__`), o IP da
> máquina do Metro tem prioridade — é lá que o backend local roda. Em build
> de produção, `hostUri` não existe e ele cai no `extra.apiUrl`.
>
> A ordem importa: se `extra.apiUrl` viesse primeiro, seria impossível testar
> qualquer mudança do backend sem publicá-la antes. Ver `src/services/api.js`.

Para Android, o mapa precisa de uma chave do Google Maps — ver
[Chave do Google Maps](#chave-do-google-maps-android).

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

### Chave do Google Maps (Android)

No **Expo Go** o mapa funciona sem configuração, porque o próprio Expo Go
traz a chave. Numa build sua, o mapa fica **cinza e vazio** sem uma chave.

Já configurada em `mobile/app.config.js` → `android.config.googleMaps.apiKey`.

**Por que ela fica num arquivo versionado.** Uma chave do Maps para Android
é embutida no APK por natureza — qualquer pessoa que baixe o app consegue
extraí-la, e o Google projetou o sistema sabendo disso. A proteção não é o
sigilo, e sim a restrição:

| Restrição | Onde | Efeito |
| --- | --- | --- |
| Apps Android | pacote `com.lixonarua.app` + SHA-1 | a chave só funciona no seu app |
| APIs | apenas Maps SDK for Android | não serve para outros serviços Google |

**Sem a restrição de aplicativo, a chave é livre e a cobrança vem para
você.** Confira no Google Cloud Console → APIs e serviços → Credenciais →
clique na chave → *Restrições de aplicativo*.

O SHA-1 do certificado de assinatura sai do EAS:

```bash
eas credentials
```

Escolha Android → o SHA-1 aparece nas credenciais de build. Adicione-o à
restrição junto com o nome do pacote.

No iOS o mapa usa Apple Maps, que não exige chave.

---

## Backup

O volume `postgres_data` guarda tudo. Sem backup, um `docker compose down -v`
apaga a base sem confirmação.

As fotos ficam no R2, que tem durabilidade própria. O backup cobre o banco,
que é o único dado existente apenas neste servidor.

### Instalar

```bash
cd ~/lixo-na-rua
chmod +x scripts/backup.sh scripts/restaurar.sh
mkdir -p ~/backups

# testar antes de agendar
./scripts/backup.sh
ls -lh ~/backups
```

Agendar para as 3h da manhã sem apagar outras tarefas que já estejam no
`crontab`:

```bash
JOB='0 3 * * * /home/lixo/lixo-na-rua/scripts/backup.sh >> /home/lixo/backups/backup.log 2>&1'
CRON_TMP="$(mktemp)"
crontab -l > "$CRON_TMP" 2>/dev/null || true
grep -qxF "$JOB" "$CRON_TMP" || printf '%s\n' "$JOB" >> "$CRON_TMP"
crontab "$CRON_TMP"
rm -f "$CRON_TMP"
```

Confira **sempre**:

```bash
crontab -l
```

Deve mostrar a tarefa de backup terminando em `2>&1`, além de quaisquer tarefas
que já existiam. O procedimento é idempotente: executá-lo novamente não duplica
a mesma linha.

O script mantém 30 dias e apaga os mais antigos. Ele também **descarta
backups menores que 1 KB**: um `pg_dump` que falha no meio produz um `.gz`
pequeno e aparentemente válido, e sem essa checagem o arquivo quebrado
substituiria silenciosamente os bons.

### Restaurar

```bash
./scripts/restaurar.sh ~/backups/db-2026-08-16-0300.sql.gz
```

O script primeiro verifica a integridade do gzip e restaura o conteúdo em um
banco temporário. Somente depois de uma importação completa ele para o backend,
troca os bancos e volta a subir o serviço. Se o backend não iniciar, tenta
recolocar o banco anterior. O banco anterior só é removido depois que o endpoint
`/health` volta a responder com sucesso. Pede confirmação digitada porque, ao
concluir com sucesso, substitui os dados atuais.

**Backup que nunca foi restaurado não é backup, é esperança.** Teste a
restauração antes de precisar dela — de preferência num servidor
descartável, não neste.

---

## Atualizar

```bash
cd /home/lixo/lixo-na-rua
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec backend npm run migrate
```

O `restart: unless-stopped` religa tudo se o servidor reiniciar.

---

## Checklist antes de ir ao ar

```
[ ] JWT_SECRET aleatorio, diferente do de desenvolvimento
[ ] DB_PASSWORD longa e exclusiva
[ ] Bucket R2 criado, com dominio publico conectado
[ ] S3_PUBLIC_URL preenchido (sem ele as fotos nao aparecem)
[ ] Fotos antigas migradas e URLs atualizadas no banco
[ ] Tunel respondendo: curl https://api-lixo.brconsultorias.com/health
[ ] CORS_ORIGIN com o dominio real do Pages
[ ] ufw ativo, so SSH entrando
[ ] Nenhum `ports:` publicado no compose de producao
[ ] Migrations aplicadas
[ ] Backup no cron e restauracao testada
[ ] Primeiro admin promovido
[ ] npm test e npm run test:integration passando
[ ] .env.prod fora do git (git check-ignore .env.prod)
```

## Monitoramento

`GET /health` responde **200** com `"database": "connected"`, ou **503** com
`"database": "unavailable"` se a API estiver de pé mas o banco fora. Os dois
códigos permitem distinguir "aplicação caiu" de "banco caiu".

O Cloudflare Zero Trust mostra o estado do túnel. O `HEALTHCHECK` do
Dockerfile usa esse mesmo endpoint.

## Dívidas conhecidas

| Item                  | Impacto                                                       | Onde          |
| --------------------- | ------------------------------------------------------------- | ------------- |
| Rate limit em memória | Com 2+ instâncias o limite se multiplica. Migrar para Redis.  | DECISOES #008 |
| Sem refresh token     | Sessão de 7 dias; expirou, login de novo.                     | —             |
| Sem rotação de logs   | Log vai para stdout; depende do coletor do provedor.           | —             |

## Ver também

- [SETUP.md](SETUP.md) — ambiente de desenvolvimento
- [ARQUITETURA.md](ARQUITETURA.md) — organização do sistema
- [DECISOES.md](DECISOES.md) — por que as escolhas foram feitas
