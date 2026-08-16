# Arquitetura

> Estado: **MVP em construção** (Semana 1 de 12). Este documento descreve o
> desenho alvo e marca claramente o que já existe e o que ainda é plano.

## Visão geral

```
┌─────────────────┐     ┌─────────────────┐
│  Mobile (Expo)  │     │  Web (Vite)     │
│  iOS / Android  │     │  navegador      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │      HTTP / JSON      │
         └───────────┬───────────┘
                     │
            ┌────────▼────────┐
            │  API (Express)  │  :3000
            │  JWT + CORS     │
            └────────┬────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
┌────────▼────────┐    ┌─────────▼────────┐
│ PostgreSQL 15   │    │  Redis 7         │
│ + PostGIS 3.3   │    │  (cache, futuro) │
│ :5432           │    │  :6379           │
└─────────────────┘    └──────────────────┘
```

## Camadas

### Apresentação

| App    | Stack                  | Porta | Situação                                     |
| ------ | ---------------------- | ----- | -------------------------------------------- |
| Web    | React 18 + Vite 5      | 3001  | ✅ login, cadastro e área autenticada         |
| Mobile | React Native + Expo 54 | 8081  | ✅ login, câmera com GPS, mapa e histórico    |
| Admin  | —                      | —     | ⏳ pasta criada, sem código                   |

Ambos guardam o token localmente (`localStorage` no web, `AsyncStorage` no
mobile) e restauram a sessão ao abrir, chamando `GET /auth/me`.

```
mobile/
├── App.js                    navegação e decisão logado/deslogado
└── src/
    ├── theme.js              cores, espaçamentos, categorias
    ├── services/api.js       cliente HTTP + descoberta do IP do backend
    ├── context/AuthContext.js
    └── screens/
        ├── LoginScreen.js
        ├── CameraScreen.js   câmera + GPS + envio
        ├── MapScreen.js      denúncias próximas
        └── HistoryScreen.js
```

O app tem três abas: **Denunciar** (câmera), **Por perto** (mapa) e
**Minhas denúncias**. O mapa consome `GET /map/nearby`, o mesmo endpoint
que o web usa — nenhuma lógica geográfica foi duplicada no cliente.

### Aplicação

API REST em Express.

| Item                       | Situação                                   |
| -------------------------- | ------------------------------------------ |
| `helmet` + `cors`          | ✅ configurados                             |
| `GET /health`              | ✅ inclui checagem do banco (503 se fora)   |
| Pool do Postgres           | ✅ `src/db.js`                              |
| Autenticação JWT           | ✅ register, login, me                      |
| Limite de tentativas       | ✅ em memória (ver DECISOES #008)           |
| Upload de imagens          | ✅ disco local (ver DECISOES #010)          |
| Rotas de denúncia          | ✅ criar, listar, detalhe                   |
| Rotas geográficas          | ✅ nearby, geojson, stats                   |
| Moderação com auditoria    | ✅ PATCH de status + histórico              |
| Testes automatizados       | ✅ 109 unitários + integração PostGIS       |
| Integração com órgãos      | ⏳ Fase 4                                   |

### Organização do backend

```
backend/
├── migrations/
│   ├── 001_init.sql          users
│   ├── 002_complaints.sql    complaints + índices + trigger
│   ├── 003_moderations.sql   trilha de auditoria da moderação
│   └── run.js                npm run migrate
├── scripts/set-role.js       promove conta a moderator/admin
├── uploads/                  fotos enviadas (fora do git)
├── src/
│   ├── index.js          sobe o servidor, encerramento limpo
│   ├── app.js            monta o Express (sem listen — testável)
│   ├── config.js         lê e valida o ambiente
│   ├── db.js             pool do Postgres
│   ├── middleware/
│   │   ├── auth.js       generateToken, requireAuth, optionalAuth, requireRole
│   │   ├── rateLimit.js  limitador de tentativas
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── complaints.js
│   │   ├── map.js        nearby, geojson, stats
│   │   └── uploads.js
│   └── utils/
│       ├── errors.js     ApiError, asyncHandler
│       └── validators.js
└── tests/
    ├── auth.test.js
    ├── complaints.test.js
    ├── validators.test.js
    ├── rateLimit.test.js
    ├── helpers/testDb.js      Postgres em memória
    └── integration/map.test.js  exige PostGIS real
```

Testes ficam em duas camadas: `npm test` roda os unitários sem banco;
`npm run test:integration` exige o Postgres com PostGIS de pé. Ver
DECISOES #015.

`optionalAuth` existe para rotas públicas que mudam de comportamento se houver
sessão — `GET /complaints?mine=true` é o caso.

`app.js` separado de `index.js` é o que permite ao Supertest exercitar a API
sem ocupar porta.

> O `/health` consulta o banco a cada chamada, então reflete o estado atual.
> Já a mensagem do boot é um retrato do instante em que o processo subiu: se o
> Postgres iniciar depois, o log dirá que o banco está fora até você digitar
> `rs` no nodemon.

### Dados

PostgreSQL 15 com extensão PostGIS 3.3, via Docker Compose.

## Modelo de dados (planejado)

Ainda **não existem migrations**. Este é o desenho alvo:

```
users
  id             uuid PK
  email          text unique
  password_hash  text
  nome           text
  role           text   -- user | moderator | admin
  created_at     timestamptz

complaints
  id             uuid PK
  user_id        uuid FK -> users.id
  title          text
  description    text
  latitude       double precision
  longitude      double precision
  location_geom  geometry(Point, 4326)   -- PostGIS
  image_url      text
  status         text   -- reported | validated | resolved | rejected
  category       text
  created_at     timestamptz

complaint_votes
  id             uuid PK
  complaint_id   uuid FK
  user_id        uuid FK
  vote_type      text   -- like | unlike
  UNIQUE (complaint_id, user_id)

complaint_comments
  id, complaint_id FK, user_id FK, body, created_at

moderations                             -- ✅ criada na migration 003
  id             uuid PK
  complaint_id   uuid FK -> complaints.id  ON DELETE CASCADE
  moderator_id   uuid FK -> users.id       ON DELETE SET NULL
  status_antes   text
  status_depois  text
  motivo         text
  created_at     timestamptz

government_agencies
  id, nome, municipio, api_endpoint, api_key

agency_access_log
  id, agency_id FK, complaint_id FK, accessed_at
```

### Por que PostGIS

O caso de uso central é geográfico: "denúncias perto de mim", mapa de calor,
agrupamento por bairro. Com PostGIS isso é uma query:

```sql
-- denúncias num raio de 500m
SELECT * FROM complaints
WHERE ST_DWithin(
  location_geom::geography,
  ST_MakePoint($1, $2)::geography,
  500
);
```

Sem PostGIS seria cálculo de Haversine na aplicação, sem índice espacial —
inviável conforme a base cresce.

Índice recomendado quando a tabela for criada:

```sql
CREATE INDEX idx_complaints_geom ON complaints USING GIST (location_geom);
```

## Fluxo principal: criar denúncia

```
Mobile                    API                     Banco
  │                        │                        │
  ├─ tira foto             │                        │
  ├─ lê GPS                │                        │
  ├─ POST /complaints ────►│                        │
  │   Bearer <jwt>         ├─ valida token          │
  │                        ├─ valida lat/lng        │
  │                        ├─ INSERT + ST_MakePoint►│
  │◄──── 201 { id, ... } ──┤                        │
```

## Decisões em aberto

- **Armazenamento de imagens** — S3 está previsto no `.env` mas sem credenciais.
  Para o MVP, avaliar salvar em disco local ou usar um bucket gratuito.
- **Moderação** — manual (fila para moderadores) ou automática (classificador de
  imagem)? Impacta a Fase 3.
- **Integração com órgãos públicos** — cada município tem API própria ou
  nenhuma. Provável fallback: exportação CSV / e-mail.

## Ver também

- [SETUP.md](SETUP.md) — subir o ambiente
- [API.md](API.md) — contrato dos endpoints
- [DECISOES.md](DECISOES.md) — registro de decisões técnicas
