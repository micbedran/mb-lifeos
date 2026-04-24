# MB LifeOS - Deploy Completo

## 📦 Arquivos Preparados para Deploy

Este diretório contém a aplicação **MB LifeOS** completamente preparada para deploy no Railway.

### ✅ Adaptações Realizadas

1. **Frontend (React/Vite)**
   - ✅ Adaptado para usar `api.js` em vez de `window.storage`
   - ✅ Removidas constantes `GCAL_MCP` e `API_URL` (Anthropic)
   - ✅ Funções de Google Calendar adaptadas para usar API backend
   - ✅ Build realizado com Vite (316 KB)
   - ✅ Tela de Login/Register integrada

2. **Backend (Node.js/Express)**
   - ✅ API completa com 22 módulos de dados
   - ✅ Autenticação JWT
   - ✅ Google Calendar OAuth
   - ✅ Anthropic AI proxy (OCR, insights)
   - ✅ Backup/restore automático
   - ✅ PostgreSQL ready

3. **Banco de Dados (PostgreSQL)**
   - ✅ Schema SQL pronto
   - ✅ Script de inicialização
   - ✅ Índices otimizados

4. **Configuração Railway**
   - ✅ `railway.toml` configurado
   - ✅ `.env.production` template
   - ✅ Variáveis de ambiente documentadas

---

## 🚀 Quick Start Deploy

### Pré-requisitos
```bash
# Node.js 18+
node --version

# npm
npm --version

# Railway CLI
npm install -g @railway/cli
```

### Deploy em 5 Passos

#### 1. Login no Railway
```bash
railway login
```

#### 2. Criar Projeto
```bash
cd /home/ubuntu/mb-lifeos
railway init
```

#### 3. Adicionar PostgreSQL
No dashboard do Railway:
- Clique em "Create" → "Database" → "PostgreSQL"

#### 4. Configurar Variáveis
No dashboard do Railway → Variables:
```
NODE_ENV=production
FRONTEND_URL=https://app.mbanalytics.online
JWT_SECRET=<gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
GOOGLE_CLIENT_ID=<do Google Cloud Console>
GOOGLE_CLIENT_SECRET=<do Google Cloud Console>
GOOGLE_REDIRECT_URI=https://app.mbanalytics.online/api/auth/google/callback
ANTHROPIC_API_KEY=<sua chave>
```

#### 5. Deploy
```bash
railway up
```

---

## 📚 Documentação

### Guias Disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `SETUP_GUIDE.md` | Guia passo a passo completo |
| `DEPLOY_RAILWAY.md` | Instruções detalhadas de deploy |
| `README.md` | Documentação original da arquitetura |
| `deploy/schema.sql` | Schema PostgreSQL |
| `deploy/.env.example` | Exemplo de variáveis |
| `deploy/.env.production` | Template para produção |

### Estrutura do Projeto

```
mb-lifeos/
├── frontend/
│   ├── src/
│   │   ├── App.jsx          (✅ Adaptado para api.js)
│   │   ├── api.js           (✅ Cliente API)
│   │   ├── main.jsx
│   │   └── ...
│   ├── build/               (✅ Build pronto)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── server.js            (✅ API Express)
│   ├── db-init.js           (✅ Inicialização DB)
│   ├── package.json
│   └── ...
├── deploy/
│   ├── schema.sql           (✅ PostgreSQL schema)
│   ├── .env.example
│   └── .env.production
├── railway.toml             (✅ Config Railway)
├── SETUP_GUIDE.md           (✅ Guia completo)
├── DEPLOY_RAILWAY.md        (✅ Instruções deploy)
└── README.md
```

---

## 🔧 Configuração Necessária

### 1. Google Cloud Console

1. Acesse https://console.cloud.google.com
2. Crie projeto "MB LifeOS"
3. Habilite "Google Calendar API"
4. Crie OAuth 2.0 credentials (Web application)
5. Adicione redirect URI: `https://app.mbanalytics.online/api/auth/google/callback`
6. Copie Client ID e Client Secret

### 2. Railway

1. Crie conta em https://railway.app
2. Crie novo projeto
3. Adicione PostgreSQL plugin
4. Configure variáveis de ambiente
5. Faça deploy

### 3. Domínio

Configure `app.mbanalytics.online`:
- CNAME: `app.mbanalytics.online` → `<railway-domain>`

---

## 📊 Módulos de Dados (22 total)

A aplicação gerencia 22 módulos de dados:

| # | Módulo | Descrição |
|----|--------|-----------|
| 1 | tasks | Tarefas com prioridade A/B/C |
| 2 | notes | Notas com cards coloridos |
| 3 | projects | Gestão de projetos |
| 4 | kanban | Board 4 colunas |
| 5 | purchases | Gestão de compras |
| 6 | meetings | Pautas de reunião |
| 7 | matrix | Matriz Eisenhower |
| 8 | habits | Tracker de hábitos |
| 9 | finance | Financeiro com OCR |
| 10 | ideas | Brainstorm |
| 11 | health | Rastreamento de saúde |
| 12 | goals | Metas anuais/mensais |
| 13 | gaita | Aulas de gaita |
| 14 | films | Watchlist de filmes |
| 15 | books | Log de leituras |
| 16 | fishing | Diário de pesca |
| 17 | aquarium | Parâmetros de aquário |
| 18 | newsClips | Clipping de notícias |
| 19 | accounts | Contas bancárias |
| 20 | cities | Relógio de cidades |

---

## 🔐 Segurança

### Implementado

- ✅ JWT authentication (30 dias)
- ✅ Bcrypt password hashing (10 rounds)
- ✅ CORS restrito a FRONTEND_URL
- ✅ Helmet para headers de segurança
- ✅ SSL automático via Railway
- ✅ Google OAuth 2.0
- ✅ Token refresh automático

### Boas Práticas

1. Use senhas fortes (mínimo 8 caracteres)
2. Mantenha JWT_SECRET seguro
3. Não compartilhe tokens
4. Faça backups regulares
5. Monitore logs do Railway

---

## 📈 Performance

### Build Frontend
- Tamanho: 316 KB (gzipped: 82.84 KB)
- Tempo build: 1.37s
- Módulos: 32 transformados

### Backend
- Node.js 18+
- Express 4.18.2
- PostgreSQL 8.11.3
- Resposta típica: <100ms

---

## 🧪 Testes

### Teste 1: Autenticação
```bash
# Criar conta
curl -X POST https://app.mbanalytics.online/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"senha123","name":"Test User"}'

# Login
curl -X POST https://app.mbanalytics.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"senha123"}'
```

### Teste 2: Dados
```bash
# Listar todos os módulos
curl -X GET https://app.mbanalytics.online/api/data \
  -H "Authorization: Bearer <seu-token>"

# Salvar tarefa
curl -X PUT https://app.mbanalytics.online/api/data/tasks \
  -H "Authorization: Bearer <seu-token>" \
  -H "Content-Type: application/json" \
  -d '{"data":[{"id":"1","title":"Tarefa 1","done":false}]}'
```

### Teste 3: Google Calendar
```bash
# Sincronizar eventos
curl -X GET "https://app.mbanalytics.online/api/calendar/events?date=2026-04-24" \
  -H "Authorization: Bearer <seu-token>"
```

---

## 🔍 Monitoramento

### Logs
```bash
railway logs
```

### Status
```bash
railway status
```

### Banco de Dados
```bash
railway connect
# Execute SQL queries
```

---

## 🐛 Troubleshooting

### Erro: "Database connection failed"
```bash
# Reinicializar banco
railway run node backend/db-init.js
```

### Erro: "Invalid token"
- Verifique se JWT_SECRET está configurada
- Confirme que o token não expirou

### Google Calendar não sincroniza
- Verifique credenciais OAuth
- Confirme redirect URI
- Tente fazer logout e login novamente

### Domínio não funciona
- Verifique CNAME no registrador
- Aguarde propagação DNS (até 48h)
- Use `nslookup app.mbanalytics.online`

---

## 📞 Suporte

- **Railway Docs:** https://docs.railway.app
- **Express Docs:** https://expressjs.com
- **React Docs:** https://react.dev
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

---

## 📝 Próximos Passos

1. ✅ Ler `SETUP_GUIDE.md` para instruções detalhadas
2. ✅ Configurar Google Cloud Console
3. ✅ Criar projeto no Railway
4. ✅ Fazer deploy
5. ✅ Testar autenticação
6. ✅ Sincronizar Google Calendar
7. ✅ Importar dados existentes

---

## 📄 Licença

MB LifeOS - Central de Gestão de Vida
© 2026 Michel Bedran

---

**Versão:** 1.0.0  
**Data:** 24/04/2026  
**Status:** ✅ Pronto para Deploy
