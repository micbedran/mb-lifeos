# MB LifeOS — Deployment Guide

## Overview
MB LifeOS é uma central de gestão de vida com 22 módulos: planejamento (anual, mensal, semanal, diário), gestão de projetos, kanban, finanças com OCR de extratos, hábitos, saúde, gaita, filmes, livros, pescaria, aquário, notícias, e mais.

**Stack:** Node.js/Express + PostgreSQL + React (Vite) + Google Calendar OAuth + Anthropic AI API

**Domínio alvo:** mbanalytics.online
**Deploy alvo:** Railway (backend + DB) ou similar

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Frontend (React)           │
│          mbanalytics.online             │
│  ┌─────┐ ┌──────┐ ┌───────┐ ┌──────┐   │
│  │Dash │ │Daily │ │Proj.  │ │Finan.│   │
│  │board│ │Plan. │ │Mgmt   │ │+OCR  │   │
│  └──┬──┘ └──┬───┘ └──┬────┘ └──┬───┘   │
│     └────────┴────────┴─────────┘       │
│              API Client (api.js)        │
└─────────────────┬───────────────────────┘
                  │ HTTP/JSON
┌─────────────────┴───────────────────────┐
│         Backend (Node.js/Express)       │
│  ┌──────┐ ┌────────┐ ┌──────────────┐  │
│  │Auth  │ │Data    │ │Google Cal    │  │
│  │JWT   │ │CRUD   │ │OAuth         │  │
│  └──┬───┘ └──┬─────┘ └──┬───────────┘  │
│     │        │           │              │
│  ┌──┴────────┴───────────┴───────────┐  │
│  │  Anthropic AI API (proxy)         │  │
│  │  - OCR extratos bancários         │  │
│  │  - Insights financeiros           │  │
│  │  - Sugestões de filmes            │  │
│  │  - Briefing de notícias           │  │
│  └───────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         PostgreSQL Database             │
│  users | user_data | oauth_tokens       │
│  backups                                │
└─────────────────────────────────────────┘
```

---

## Step-by-Step Deployment (for Manus)

### 1. Create Railway Project
```bash
# Install Railway CLI if needed
npm i -g @railway/cli
railway login
railway init
```

### 2. Add PostgreSQL Database
- In Railway dashboard, add PostgreSQL plugin
- Railway automatically sets DATABASE_URL

### 3. Set Environment Variables
In Railway dashboard → Variables, add:
```
NODE_ENV=production
JWT_SECRET=<generate 64 char random string>
FRONTEND_URL=https://mbanalytics.online
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REDIRECT_URI=https://mbanalytics.online/api/auth/google/callback
ANTHROPIC_API_KEY=<Michel's API key>
```

### 4. Google Calendar Setup
1. Go to https://console.cloud.google.com
2. Create project "MB LifeOS"
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `https://mbanalytics.online/api/auth/google/callback`
6. Copy Client ID and Secret to Railway env vars

### 5. Initialize Database
```bash
cd backend
npm install
node db-init.js
```

### 6. Build Frontend
```bash
cd frontend
npm install
# Copy the artifact code (planner-longevitech.jsx) to src/App.jsx
# Adapt: replace window.storage calls with api.js imports
# Replace fetch(API_URL) calls with api.js functions
npm run build
```

### 7. Deploy
```bash
cd ..
railway up
```

### 8. Configure Domain
In Railway → Settings → Domains → Add mbanalytics.online

---

## Frontend Adaptation Guide

The frontend code is the artifact (planner-longevitech.jsx) with these changes:

### Replace Storage
```javascript
// OLD (artifact)
const store = {
  async get(k) { return window.storage.get(k); },
  async set(k, v) { return window.storage.set(k, v); },
};

// NEW (deploy)
import { loadAllData, saveModule } from './api';
```

### Replace Calendar Sync
```javascript
// OLD (artifact - broken in sandbox)
async function fetchEvents(dateStr) {
  return calendarAction(`List events...`);
}

// NEW (deploy - direct API)
import { fetchCalendarEvents } from './api';
const events = await fetchCalendarEvents('2026-04-24');
```

### Replace AI Calls
```javascript
// OLD (artifact)
const res = await fetch(API_URL, { body: JSON.stringify({...}) });

// NEW (deploy - proxied through backend)
import { aiInsights, aiOCR } from './api';
const insights = await aiInsights('Analise meus gastos...');
```

### Add Login Screen
The frontend needs a login/register screen before the main app.
Check if `isAuthenticated()` returns true; if not, show login form.

---

## Data Migration

Michel has existing data exported as JSON from the artifact.
To import:
1. Register account on the deployed app
2. Use the Import feature or call:
```bash
curl -X PUT https://mbanalytics.online/api/data \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @mb-lifeos-backup.json
```

---

## Modules (22 total)

| Module | Storage Key | Description |
|--------|------------|-------------|
| tasks | planner-tasks | Tarefas com prioridade A/B/C e recorrência |
| notes | planner-notes | Notas com cards coloridos |
| projects | planner-projects | Projetos completos com fases, entregas, riscos |
| kanban | planner-kanban | Board 4 colunas |
| purchases | planner-purchases | Compras e importação |
| meetings | planner-meetings | Pautas de reunião |
| matrix | planner-matrix | Matriz Eisenhower |
| habits | planner-habits | Tracker 10 hábitos x 31 dias |
| finance | planner-finance | Financeiro com OCR de extratos |
| ideas | planner-ideas | Brainstorm |
| health | planner-health | Saúde (água, sono, energia, humor) |
| goals | planner-goals | Metas anuais e mensais |
| gaita | planner-gaita | Acompanhamento aulas de gaita |
| films | planner-films | Watchlist e histórico de filmes |
| books | planner-books | Log de leituras com progresso |
| fishing | planner-fishing | Diário de pesca |
| aquarium | planner-aquarium | Parâmetros, manutenção, inventário |
| newsClips | planner-newsClips | Clipping de notícias |
| accounts | planner-accounts | Contas bancárias com saldo |
| cities | planner-cities | Cidades para relógio/clima |

---

## API Endpoints Summary

### Auth
- POST /api/auth/register - Criar conta
- POST /api/auth/login - Login (retorna JWT)
- GET /api/auth/me - Dados do usuário logado

### Data (Generic CRUD)
- GET /api/data - Todos os módulos
- GET /api/data/:module - Um módulo
- PUT /api/data/:module - Salvar módulo
- PUT /api/data - Salvar todos

### Calendar
- GET /api/auth/google - URL de autorização OAuth
- GET /api/auth/google/callback - Callback OAuth
- GET /api/calendar/status - Status da conexão
- GET /api/calendar/events?date=YYYY-MM-DD - Listar eventos
- POST /api/calendar/events - Criar evento
- PUT /api/calendar/events/:id - Atualizar evento
- DELETE /api/calendar/events/:id - Deletar evento

### AI
- POST /api/ai/insights - Análises com Claude
- POST /api/ai/ocr - OCR de extratos bancários

### Backup
- POST /api/backup - Criar backup
- GET /api/backup/list - Listar backups
- POST /api/backup/:id/restore - Restaurar backup

---

## Security
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire in 30 days
- All data endpoints require auth
- Google tokens auto-refresh
- CORS restricted to FRONTEND_URL
- Helmet for HTTP security headers
- SSL via Railway
