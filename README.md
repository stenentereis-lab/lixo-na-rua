# 🗑️ Lixo na Rua

Aplicativo multiplataforma para denúncia de lixo na rua com foto georreferenciada.

## Tech Stack

- **Backend**: Node.js + Express + PostgreSQL + PostGIS
- **Mobile**: React Native + Expo
- **Web**: React + Vite
- **DevOps**: Docker + GitHub Actions

## Portas

| Serviço  | Porta | URL                    |
| -------- | ----- | ---------------------- |
| Backend  | 3000  | http://localhost:3000  |
| Web      | 3001  | http://localhost:3001  |
| Mobile   | 8081  | Expo (QR code)         |
| Postgres | 5432  | —                      |
| Redis    | 6379  | —                      |

> Backend e Web usam portas diferentes de propósito. Rodar os dois na 3000 causa conflito.

## Pré-requisitos

- Node.js v18+
- Docker Desktop (requer WSL no Windows: `wsl --install`)
- Git

## Setup

Cada serviço roda em um terminal separado.

```powershell
# 1. Banco de dados
cd C:\lixo-na-rua
docker compose up -d postgres

# 2. Backend  (novo terminal)
cd C:\lixo-na-rua\backend
npm install
npm run migrate      # cria as tabelas (só na primeira vez)
npm run dev
# -> http://localhost:3000/health

# 3. Web  (novo terminal)
cd C:\lixo-na-rua\web
npm install
npm start
# -> http://localhost:3001

# 4. Mobile  (novo terminal)
cd C:\lixo-na-rua\mobile
npm install --legacy-peer-deps
npx expo start
```

## Verificação

```powershell
# Backend e banco respondendo
curl http://localhost:3000/health
# {"status":"OK","database":"connected",...}

# Container do banco saudável
docker compose ps

# Suíte de testes (não precisa de Docker)
cd C:\lixo-na-rua\backend
npm test

# Testes das consultas geográficas (exigem o Postgres de pé)
npm run test:integration
```

Abra http://localhost:3001, crie uma conta e entre. A área autenticada mostra o
status ao vivo dos três serviços.

## Virar administrador

Não há cadastro privilegiado — todo registro cria uma conta comum. Cadastre-se
pelo app e depois promova a conta:

```powershell
cd C:\lixo-na-rua\backend
npm run set-role -- voce@exemplo.com admin
```

Saia e entre de novo no app para o token refletir o novo papel — ele viaja
dentro do token, que já foi emitido.

A aba **Moderação** passa a aparecer no web, com a fila de denúncias
aguardando análise. Detalhes em
[docs/API.md](docs/API.md#papéis-de-usuário).

## Funcionalidades

| Recurso                          | Situação   |
| -------------------------------- | ---------- |
| Cadastro e login (JWT)           | ✅ pronto   |
| Sessão persistente (web e mobile) | ✅ pronto   |
| Captura de foto com GPS (mobile) | ✅ pronto   |
| Envio e listagem de denúncias    | ✅ pronto   |
| Mapa, mapa de calor e estatísticas | ✅ pronto   |
| Busca por proximidade (raio)     | ✅ pronto   |
| Moderação com trilha de auditoria | ✅ pronto   |
| Integração com órgãos públicos   | ⏳ Fase 4   |

## Variáveis de ambiente

Cada serviço tem um `.env.example` versionado. Copie e ajuste:

```powershell
copy backend\.env.example backend\.env
copy web\.env.example web\.env
```

- `backend/.env` — conexão com o banco, `JWT_SECRET`, `CORS_ORIGIN`
- `web/.env` — `VITE_API_URL` (padrão `http://localhost:3000`)

Variáveis do frontend precisam do prefixo `VITE_` para o Vite expor ao browser —
e por isso mesmo **nunca coloque segredo lá**, tudo vai para o bundle público.

## Documentação

| Documento                                      | Para quê                                  |
| ---------------------------------------------- | ----------------------------------------- |
| [docs/SETUP.md](docs/SETUP.md)                 | Ambiente do zero + problemas conhecidos   |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md)     | Organização do sistema e modelo de dados  |
| [docs/API.md](docs/API.md)                     | Contrato dos endpoints                    |
| [docs/DECISOES.md](docs/DECISOES.md)           | Decisões técnicas e seus custos           |
| [docs/CONTRIBUINDO.md](docs/CONTRIBUINDO.md)   | Padrões de commit, código e segurança     |

## Estrutura

```
.
├── backend/          # Node.js + Express + PostGIS
├── mobile/           # React Native + Expo
├── web/              # React + Vite
│   ├── index.html    # entrada do Vite (raiz, não em public/)
│   └── src/
│       ├── main.jsx  # bootstrap do React
│       └── App.jsx
├── admin/            # Painel administrativo
├── docs/             # Documentação
└── docker-compose.yml
```

## Problemas conhecidos

| Sintoma                                                | Causa                       | Solução                                                     |
| ------------------------------------------------------ | --------------------------- | ----------------------------------------------------------- |
| `docker: não é reconhecido`                            | Docker Desktop parado       | Abrir Docker Desktop e aguardar o engine subir               |
| `Docker Desktop - WSL not installed`                   | WSL ausente                 | PowerShell admin: `wsl --install`, reiniciar                 |
| `'nodemon'/'vite' não é reconhecido`                   | Dependências não instaladas | `npm install` na pasta do serviço                            |
| `Database error` no backend                            | Postgres não subiu          | `docker compose up -d postgres`, aguardar ~30s               |
| Porta 3000 em uso                                      | Backend e web na mesma porta | Web usa 3001 (definido em `vite.config.js`)                  |
| `&&` não funciona no PowerShell                        | PowerShell 5.1              | Rodar um comando por linha                                   |

## Histórico de decisões

- **Create React App → Vite** (ago/2026): o `react-scripts` apresentava conflito
  de dependências (`ajv` / `ajv-keywords`) e falha do dev server
  (`options.allowedHosts[0] should be a non-empty string`). O CRA está
  descontinuado. O Vite sobe em ~100ms e removeu ~1200 pacotes transitivos.

## Team

Desenvolvido por Aeroambiental

## License

MIT
