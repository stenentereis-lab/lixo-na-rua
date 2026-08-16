# API

Base URL (dev): `http://localhost:3000`

Todas as respostas são JSON. Datas em ISO 8601 (UTC).

## Convenções

### Autenticação

Endpoints protegidos (🔒) exigem o header:

```
Authorization: Bearer <jwt>
```

Token expira em 7 dias (`JWT_EXPIRY` no `.env`). O payload carrega apenas
`sub` (id do usuário) e `role` — o JWT é **assinado, não criptografado**, então
nada sensível entra ali.

### Códigos de status

| Código | Quando                                   |
| ------ | ---------------------------------------- |
| 200    | Sucesso                                  |
| 201    | Recurso criado                           |
| 400    | Erro de validação no corpo da requisição |
| 401    | Token ausente, inválido ou expirado      |
| 403    | Autenticado, mas sem permissão           |
| 404    | Recurso não encontrado                   |
| 409    | Conflito (ex.: e-mail já cadastrado)     |
| 429    | Excesso de tentativas                    |
| 503    | API no ar, mas dependência indisponível  |

### Formato de erro

```json
{ "error": "mensagem legível" }
```

Erros de validação trazem também o detalhe por campo:

```json
{
  "error": "Dados inválidos",
  "details": {
    "email": "E-mail inválido",
    "password": "Senha deve ter pelo menos 8 caracteres"
  }
}
```

### Limite de tentativas

| Rota             | Limite               |
| ---------------- | -------------------- |
| `/auth/login`    | 5 por 15 min por IP  |
| `/auth/register` | 10 por hora por IP   |

Ao estourar: **429** com header `Retry-After` em segundos.

> Contagem em memória do processo. Ao rodar mais de uma instância da API,
> migrar para Redis. Ver `docs/DECISOES.md` #008.

---

## ✅ Implementado

### `GET /health`

Diagnóstico do serviço. Sem autenticação.

**200** — API e banco de pé

```json
{
  "status": "OK",
  "database": "connected",
  "timestamp": "2026-08-16T02:41:54.663Z",
  "app": "Lixo na Rua API v1.0"
}
```

**503** — API no ar, banco fora. `status` vira `DEGRADED` e `database`,
`unavailable`. O status HTTP diferente permite que um monitoramento externo
distinga "aplicação caiu" de "banco caiu".

```powershell
curl http://localhost:3000/health
```

---

### `POST /auth/register`

Cria uma conta e já devolve o token, para o usuário não precisar fazer login
em seguida.

**Corpo**

```json
{
  "email": "maria@example.com",
  "password": "senha-forte-123",
  "nome": "Maria Silva"
}
```

| Campo    | Regra                                       |
| -------- | ------------------------------------------- |
| email    | obrigatório, formato válido, até 254 chars  |
| password | obrigatório, 8 a 128 caracteres             |
| nome     | obrigatório, até 120 caracteres             |

O e-mail é normalizado (minúsculo, sem espaços nas pontas), então
`" Maria@Example.COM "` e `maria@example.com` são a mesma conta.

**201**

```json
{
  "user": {
    "id": "098cbaff-4755-4e31-80e9-d72789ea07b0",
    "email": "maria@example.com",
    "nome": "Maria Silva",
    "role": "user",
    "created_at": "2026-08-16T02:41:54.741Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**400** validação · **409** e-mail já cadastrado · **429** excesso

> O campo `role` é **sempre** `user`. Mandar `"role": "admin"` no corpo não
> tem efeito — há teste cobrindo essa tentativa de escalada de privilégio.
> Para promover alguém, veja [Papéis de usuário](#papéis-de-usuário).
> A senha nunca aparece na resposta; é gravada como hash bcrypt (10 rounds).

```powershell
curl -X POST http://localhost:3000/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"maria@example.com\",\"password\":\"senha-forte-123\",\"nome\":\"Maria Silva\"}'
```

---

### `POST /auth/login`

**Corpo**

```json
{ "email": "maria@example.com", "password": "senha-forte-123" }
```

**200** — mesmo formato do register.

**401** — `{ "error": "E-mail ou senha inválidos" }`

> A mensagem é **idêntica** para e-mail inexistente e senha errada. Diferenciar
> permitiria descobrir quais e-mails estão cadastrados na base.

**400** falta campo · **429** excesso de tentativas

---

### `GET /auth/me` 🔒

Devolve o usuário do token. Usado pelo app para restaurar a sessão ao abrir.

**200**

```json
{
  "user": {
    "id": "098cbaff-...",
    "email": "maria@example.com",
    "nome": "Maria Silva",
    "role": "user",
    "created_at": "2026-08-16T02:41:54.741Z"
  }
}
```

**401** — token ausente, malformado, assinado com outro segredo, ou expirado
(neste caso a mensagem é `Sessão expirada. Faça login novamente.`, para o app
saber que deve redirecionar ao login em vez de mostrar erro genérico).

**404** — token válido de conta que foi removida.

```powershell
curl http://localhost:3000/auth/me -H "Authorization: Bearer SEU_TOKEN"
```

---

## Papéis de usuário

| Papel       | Pode                                                          |
| ----------- | ------------------------------------------------------------- |
| `user`      | Criar denúncias, votar, comentar. Padrão de todo cadastro.     |
| `moderator` | Tudo do `user` + validar e rejeitar denúncias de terceiros.    |
| `admin`     | Tudo do `moderator` + gerenciar usuários e órgãos públicos.    |

> ⚠️ Os papéis existem no banco e o middleware `requireRole` está pronto, mas
> **nenhuma rota exige papel elevado ainda** — as funcionalidades de moderação
> chegam na Fase 3. Hoje, ser admin não muda o que você vê no app.

### Promover uma conta

Não existe rota HTTP para isso, de propósito: seria alvo óbvio de ataque. A
operação exige acesso ao servidor.

```powershell
cd C:\lixo-na-rua\backend
npm run set-role -- voce@exemplo.com admin
```

O `--` é necessário para o npm repassar os argumentos.

```
✅ Maria Silva <voce@exemplo.com> agora é "admin".
   Saia e entre novamente no app para o token refletir o novo papel.
```

O papel vai dentro do JWT, que já foi emitido — por isso é preciso fazer login
de novo para a mudança valer.

---

### `POST /uploads` 🔒

Envia uma imagem e devolve a URL. `multipart/form-data`, campo `image`.

| Regra   | Valor                             |
| ------- | --------------------------------- |
| Formatos | JPEG, PNG, WebP, HEIC            |
| Tamanho | até 10 MB                         |
| Arquivos | 1 por requisição                 |

**201**

```json
{
  "url": "/uploads/7f3a1e2c-....jpg",
  "filename": "7f3a1e2c-....jpg",
  "size": 842103
}
```

**400** formato não suportado, arquivo muito grande, ou nenhum arquivo · **401**

> O arquivo recebe **nome aleatório**. Manter o nome enviado pelo cliente
> permitiria sobrescrever arquivos de outros usuários e tentativas de path
> traversal (`../../etc/passwd`).

As imagens são servidas como estático em `GET /uploads/<filename>`.

```powershell
curl -X POST http://localhost:3000/uploads `
  -H "Authorization: Bearer TOKEN" `
  -F "image=@foto.jpg"
```

---

### `POST /complaints` 🔒

Registra uma denúncia.

**Corpo**

```json
{
  "title": "Lixo acumulado na calçada",
  "description": "Sacos há mais de uma semana",
  "latitude": -15.7942,
  "longitude": -48.0192,
  "image_url": "/uploads/7f3a1e2c-....jpg",
  "category": "trash"
}
```

| Campo       | Regra                                                  |
| ----------- | ------------------------------------------------------ |
| title       | obrigatório, até 140 caracteres                        |
| description | opcional, até 2000 caracteres                          |
| latitude    | obrigatório, -90 a 90                                  |
| longitude   | obrigatório, -180 a 180                                |
| category    | `trash` (padrão) \| `debris` \| `sewage` \| `other`     |
| image_url   | opcional, normalmente o `url` devolvido por `/uploads`  |

Coordenadas são aceitas como número ou texto — `multipart/form-data` entrega
tudo como string.

**201**

```json
{
  "complaint": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Lixo acumulado na calçada",
    "latitude": -15.7942,
    "longitude": -48.0192,
    "status": "reported",
    "category": "trash",
    "created_at": "2026-08-16T03:12:00.000Z"
  }
}
```

**400** validação · **401** sem token

> `user_id` e `status` enviados no corpo são **ignorados**. O autor vem do
> token (aceitá-lo do corpo permitiria denunciar no nome de outra pessoa) e o
> status só muda pela moderação. Há teste cobrindo as duas tentativas.

---

### `GET /complaints`

Lista pública, mais recentes primeiro.

| Query    | Padrão | Descrição                            |
| -------- | ------ | ------------------------------------ |
| page     | 1      | página                               |
| limit    | 20     | teto de 100                          |
| status   | —      | filtra por status                    |
| category | —      | filtra por categoria                 |
| mine     | —      | `true` devolve só as suas 🔒          |

**200**

```json
{
  "data": [ { "id": "uuid", "title": "...", "latitude": -15.79, "status": "reported" } ],
  "page": 1,
  "limit": 20,
  "total": 137
}
```

`total` é do conjunto filtrado, não da página.

**400** status ou categoria inválidos · **401** `mine=true` sem token

> `location_geom` nunca sai na resposta: é derivada de lat/lng por trigger e o
> formato binário do PostGIS não serve ao cliente.

---

### `GET /complaints/:id`

**200** `{ complaint }` · **400** id fora do formato UUID · **404** inexistente

> O 400 existe para que `/complaints/abc` não vire erro 500 no cast do Postgres.

---

## ⏳ Planejado — fases seguintes

| Endpoint                    | Descrição                                          |
| --------------------------- | -------------------------------------------------- |
| `GET /map/nearby`           | Denúncias num raio (`ST_DWithin`)                   |
| `GET /map/geojson`          | `FeatureCollection` para Mapbox / Leaflet           |
| `PATCH /complaints/:id`     | 🔒 Moderação: mudar status (moderator/admin)        |
| `POST /complaints/:id/vote` | 🔒 Voto único por usuário, repetir remove           |
| `GET /stats`                | Totais por status, categoria e série temporal       |

---

## Como documentar um endpoint novo

Registre: método, rota, se exige auth, corpo, resposta de sucesso, erros
possíveis e um exemplo `curl`. Faça isso **no mesmo commit do código** —
documentação de API desatualizada é pior que nenhuma, porque induz ao erro.
