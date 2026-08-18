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

| Papel       | Pode                                                                  |
| ----------- | --------------------------------------------------------------------- |
| `user`      | Criar denúncias e remover as próprias. Padrão de todo cadastro.        |
| `moderator` | Tudo do `user` + mudar status de qualquer denúncia e ver o histórico.  |
| `admin`     | Tudo do `moderator` + remover qualquer denúncia.                      |

No web, a aba **Moderação** só aparece para `moderator` e `admin`. Esconder a
aba é conveniência de interface — o backend valida o papel em toda requisição,
que é onde o controle de acesso de fato acontece.

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

### `POST /beta-signups`

Registra um interessado no programa comunitário. Pública, limitada a cinco
tentativas por IP a cada hora. O e-mail é único.

```json
{
  "nome": "Ana Testadora",
  "email": "ana@example.com",
  "cidade": "Campo Grande",
  "uf": "MS",
  "aparelho": "Samsung Galaxy A54",
  "android_version": "14",
  "age_confirmed": true,
  "accepted_beta_terms": true,
  "beta_terms_version": "1.1",
  "acknowledged_privacy": true,
  "privacy_version": "1.0"
}
```

**201** `{ "message": "Inscrição recebida com sucesso" }` · **400** validação
· **409** e-mail já inscrito · **429** excesso de tentativas. O frontend só
apresenta o link do APK depois desta resposta de sucesso.

---

### `GET /beta-signups` 🔒 admin

Lista até 500 inscrições, da mais recente para a mais antiga, e devolve totais
globais por situação.

| Query | Descrição |
| ----- | --------- |
| `status` | `pending`, `invited`, `accepted`, `declined` ou `removed` |
| `search` | busca parcial por nome, e-mail, cidade ou aparelho |

```json
{
  "data": [{
    "id": "uuid", "nome": "Ana Testadora", "email": "ana@example.com",
    "cidade": "Campo Grande", "uf": "MS", "aparelho": "Galaxy A54",
    "android_version": "14", "status": "pending",
    "created_at": "2026-08-18T12:00:00.000Z"
  }],
  "summary": {
    "pending": 1, "invited": 0, "accepted": 0,
    "declined": 0, "removed": 0, "total": 1
  }
}
```

**401** sem autenticação · **403** perfil diferente de `admin`.

---

### `PATCH /beta-signups/:id/status` 🔒 admin

Atualiza a situação administrativa da inscrição.

```json
{ "status": "accepted" }
```

**200** inscrição atualizada · **400** situação inválida · **401/403** acesso
negado · **404** inscrição inexistente.

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

| Campo           | Regra                                                  |
| --------------- | ------------------------------------------------------ |
| title           | obrigatório, até 140 caracteres                        |
| description     | opcional, até 2000 caracteres                          |
| latitude        | obrigatório, -90 a 90                                  |
| longitude       | obrigatório, -180 a 180                                |
| accuracy_meters | opcional, raio de incerteza do GPS em metros           |
| category        | `trash` (padrão) \| `debris` \| `sewage` \| `other`     |
| image_url       | opcional, normalmente o `url` devolvido por `/uploads`  |

> **Por que guardar a precisão.** Uma denúncia com ±1 m aponta o ponto exato
> do lixo; uma com ±50 m aponta um quarteirão. Para quem modera, ou para o
> órgão público que recebe a lista, é a diferença entre "está ali" e "está
> por aqui em algum lugar".
>
> O campo é opcional porque o aparelho pode não informar, e porque denúncias
> criadas antes da migration 004 não têm o dado.

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

| Query        | Padrão | Descrição                                     |
| ------------ | ------ | --------------------------------------------- |
| page         | 1      | página                                        |
| limit        | 20     | teto de 100                                   |
| status       | —      | filtra por status                             |
| category     | —      | filtra por categoria                          |
| mine         | —      | `true` devolve só as suas 🔒                   |
| max_accuracy | —      | só denúncias com precisão até N metros        |

> `max_accuracy` **exclui denúncias sem o dado**: sem precisão registrada,
> não dá para afirmar que a coordenada é confiável.

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

### `GET /map/nearby`

Denúncias dentro de um raio, da mais próxima para a mais distante. Pública.

| Query    | Obrigatório | Padrão | Descrição                     |
| -------- | ----------- | ------ | ----------------------------- |
| lat      | sim         | —      | -90 a 90                      |
| lng      | sim         | —      | -180 a 180                    |
| radius   | não         | 1000   | metros, máximo 50000          |
| status   | não         | —      | filtra por status             |
| category | não         | —      | filtra por categoria          |
| limit    | não         | 100    | teto de 100                   |

**200**

```json
{
  "data": [
    { "id": "uuid", "title": "Lixo na calçada", "latitude": -15.79,
      "longitude": -48.01, "distance_meters": 137 }
  ],
  "center": { "latitude": -15.7942, "longitude": -48.0192 },
  "radius": 1000,
  "total": 1
}
```

**400** coordenadas ausentes ou fora do intervalo, raio acima do teto

```powershell
curl "http://localhost:3000/map/nearby?lat=-15.7942&lng=-48.0192&radius=500"
```

> Usa `ST_DWithin` sobre `geography`, que calcula em metros e aproveita o
> índice GIST. Filtrar por `ST_Distance` no `WHERE` funcionaria, mas forçaria
> varredura completa da tabela.

---

### `GET /map/geojson`

`FeatureCollection` pronta para Leaflet, Mapbox ou OpenLayers. Pública.

| Query    | Padrão | Descrição                              |
| -------- | ------ | -------------------------------------- |
| bbox     | —      | `oeste,sul,leste,norte` — só o visível  |
| status   | —      | filtra por status                      |
| category | —      | filtra por categoria                   |
| limit    | 1000   | teto de 5000                           |

**200**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "uuid",
      "geometry": { "type": "Point", "coordinates": [-48.0192, -15.7942] },
      "properties": {
        "title": "Lixo na calçada",
        "category": "trash",
        "status": "reported",
        "image_url": "/uploads/....jpg",
        "created_at": "2026-08-16T03:12:00.000Z"
      }
    }
  ]
}
```

**400** bbox malformada ou fora dos limites do globo

> ⚠️ GeoJSON usa **`[longitude, latitude]`**, nessa ordem — o inverso do que
> quase todo mundo escreve. Trocar os dois joga as denúncias de Brasília na
> Somália. Há teste de integração cobrindo isso.

---

### `GET /map/stats`

Agregados para o painel. Pública.

| Query | Padrão | Descrição                        |
| ----- | ------ | -------------------------------- |
| days  | 30     | janela da série, máximo 365      |

**200**

```json
{
  "total": 137,
  "by_status":   [ { "status": "reported", "total": 120 } ],
  "by_category": [ { "category": "trash", "total": 98 } ],
  "last_days":   [ { "dia": "2026-08-15", "total": 7 } ],
  "window_days": 30
}
```

---

### `PATCH /complaints/:id` 🔒 moderator · admin

Muda o status de uma denúncia e registra a decisão.

**Corpo**

```json
{ "status": "rejected", "motivo": "Local já limpo na visita" }
```

Transições permitidas:

| De          | Para                      |
| ----------- | ------------------------- |
| `reported`  | `validated`, `rejected`   |
| `validated` | `resolved`, `rejected`    |
| `rejected`  | `reported` (reabrir)      |
| `resolved`  | `validated` (lixo voltou) |

**200** `{ complaint }` · **400** transição inválida ou motivo ausente ·
**403** usuário comum · **404**

> `motivo` é **obrigatório** ao rejeitar — rejeitar sem explicar deixa o
> cidadão sem saber o que corrigir.
>
> Ser autor da denúncia **não** dá poder de moderá-la: senão qualquer um
> validaria a própria. Há teste cobrindo isso.
>
> A mudança de status e o registro de auditoria acontecem na **mesma
> transação**. Uma denúncia com status novo e sem histórico seria uma
> decisão sem autor.

---

### `GET /complaints/:id/moderations` 🔒 moderator · admin

Histórico de decisões, da mais recente para a mais antiga.

**200**

```json
{
  "data": [
    {
      "id": "uuid",
      "status_antes": "reported",
      "status_depois": "rejected",
      "motivo": "Duplicada",
      "moderador_nome": "Maria Silva",
      "created_at": "2026-08-16T04:10:00.000Z"
    }
  ]
}
```

`moderador_nome` vem `null` se a conta do moderador foi removida — a
decisão permanece registrada de propósito.

---

### `DELETE /complaints/:id` 🔒

Remove uma denúncia.

| Quem       | Pode remover           |
| ---------- | ---------------------- |
| autor      | a própria denúncia     |
| admin      | qualquer denúncia      |
| moderator  | **não** — só muda status |

**204** sem corpo · **403** denúncia de outra pessoa · **404**

> Moderador não remove de propósito: remoção apaga a trilha, moderação a
> preserva. São poderes distintos.

---

## ⏳ Planejado — fases seguintes

| Endpoint                       | Descrição                                  |
| ------------------------------ | ------------------------------------------ |
| `POST /complaints/:id/vote`    | 🔒 Voto único por usuário, repetir remove   |
| `GET /complaints/:id/comments` | Comentários                                |
| `POST /agencies/:id/export`    | Envio para órgãos públicos                 |

---

## Como documentar um endpoint novo

Registre: método, rota, se exige auth, corpo, resposta de sucesso, erros
possíveis e um exemplo `curl`. Faça isso **no mesmo commit do código** —
documentação de API desatualizada é pior que nenhuma, porque induz ao erro.
