# 🗑️ Lixo na Rua

Aplicativo multiplataforma para denúncia de lixo na rua com foto georreferenciada.

## Tech Stack

- **Backend**: Node.js + Express + PostgreSQL + PostGIS
- **Mobile**: React Native + Expo
- **Web**: React + Tailwind CSS
- **DevOps**: Docker + GitHub Actions

## Setup Rápido

### Pré-requisitos
- Node.js v18+
- Docker & Docker Compose
- Git

### Iniciar

```bash
# 1. Start database
docker-compose up -d postgres

# 2. Backend
cd backend
npm install
npm run dev

# 3. Mobile (terminal novo)
cd mobile
npm install
npx expo start

# 4. Web (terminal novo)
cd web
npm install
npm start
```

## Estrutura

```
.
├── backend/          # Node.js + Express
├── mobile/          # React Native + Expo
├── web/             # React
├── admin/           # Admin panel
├── docs/            # Documentação
└── docker-compose.yml
```

## Team

Desenvolvido por Aeroambiental

## License

MIT
