# PROMPT PARA O MANUS — MB LifeOS Deploy

## Contexto
Preciso fazer o deploy de uma aplicação web chamada MB LifeOS no Railway com domínio mbanalytics.online. A aplicação é uma central de gestão de vida com 22 módulos: planejamento diário/semanal/mensal/anual, projetos, kanban, finanças com OCR de extratos, hábitos, Google Calendar sync, e mais.

## Arquivos do projeto
O código completo está na pasta mb-lifeos/ com a seguinte estrutura:
- README.md — documentação completa com arquitetura
- backend/server.js — API Node.js/Express com todas as rotas
- backend/package.json — dependências do backend
- backend/db-init.js — script de inicialização do banco
- frontend/src/App.jsx — código React do app (precisa adaptação)
- frontend/src/api.js — cliente API que substitui window.storage
- frontend/src/main.jsx — entry point
- frontend/index.html — HTML base com PWA support
- frontend/vite.config.js — config do Vite
- frontend/package.json — dependências do frontend
- frontend/public/manifest.json — manifest PWA
- deploy/schema.sql — schema PostgreSQL
- deploy/.env.example — variáveis de ambiente necessárias
- railway.toml — config de deploy Railway

## O que precisa ser feito

### 1. Frontend Adaptation (CRÍTICO)
O App.jsx atual vem do protótipo Claude e usa:
- `window.storage` para persistência → trocar por chamadas a api.js
- `fetch("https://api.anthropic.com/v1/messages")` para IA → trocar por api.js (aiInsights, aiOCR)
- MCP para Google Calendar → trocar por api.js (fetchCalendarEvents, etc.)

Mudanças específicas:
a) Remover as constantes GCAL_MCP e API_URL
b) Importar funções de ./api.js
c) Substituir o objeto `store` por chamadas a loadAllData/saveModule
d) Substituir calendarAction/fetchEvents por fetchCalendarEvents do api.js
e) Adicionar tela de Login/Register antes do app principal
f) Trocar sendPrompt por funções diretas da API

### 2. Railway Setup
- Criar projeto no Railway
- Adicionar plugin PostgreSQL
- Configurar variáveis de ambiente (ver .env.example)
- Rodar db-init.js para criar tabelas
- Deploy

### 3. Google Calendar OAuth
- Criar projeto no Google Cloud Console
- Habilitar Google Calendar API
- Criar credenciais OAuth 2.0
- Redirect URI: https://mbanalytics.online/api/auth/google/callback
- Salvar Client ID e Secret nas env vars

### 4. Domínio
- Configurar mbanalytics.online no Railway
- SSL automático

## Prioridades
1. Login/Register funcionando
2. Todos os 22 módulos salvando/carregando do banco
3. Google Calendar sync direto (sem MCP)
4. Export/Import JSON funcionando
5. AI features (OCR extratos, insights) funcionando
6. PWA no celular

## Usuário inicial
- Email: michelbedran@gmail.com
- O usuário vai importar dados de um JSON existente após o primeiro login

## Stack
- Backend: Node.js 18+, Express, PostgreSQL, JWT, googleapis
- Frontend: React 18, Vite
- Deploy: Railway
- Domínio: mbanalytics.online (já em uso para outro projeto, pode precisar subdomínio como app.mbanalytics.online)
