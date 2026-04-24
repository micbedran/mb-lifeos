# MB LifeOS - Instruções de Deploy no Railway

## Status da Preparação

✅ **Concluído:**
- Frontend adaptado para usar `api.js` em vez de `window.storage`
- Funções de Google Calendar adaptadas para usar API backend
- Frontend buildado com Vite (316 KB)
- Backend dependências instaladas
- Estrutura pronta para deploy

## Pré-requisitos

1. **Conta Railway** - https://railway.app
2. **Domínio** - `app.mbanalytics.online` (já configurado)
3. **Google Cloud Console** - Para OAuth do Google Calendar
4. **Anthropic API Key** - Para features de IA (OCR, insights)

## Passo 1: Criar Projeto no Railway

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login no Railway
railway login

# Inicializar projeto
cd /home/ubuntu/mb-lifeos
railway init
```

## Passo 2: Adicionar PostgreSQL

No dashboard do Railway:
1. Clique em "Create" → "Database" → "PostgreSQL"
2. Railway criará automaticamente a variável `DATABASE_URL`

## Passo 3: Configurar Variáveis de Ambiente

No Railway dashboard → Variables, adicione:

```
# Server
NODE_ENV=production
FRONTEND_URL=https://app.mbanalytics.online
PORT=3001

# JWT (gere uma string aleatória de 64 caracteres)
JWT_SECRET=<GERAR_STRING_ALEATORIA_64_CHARS>

# Google Calendar OAuth (obter no Google Cloud Console)
GOOGLE_CLIENT_ID=<SEU_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<SEU_CLIENT_SECRET>
GOOGLE_REDIRECT_URI=https://app.mbanalytics.online/api/auth/google/callback

# Anthropic API (para features de IA)
ANTHROPIC_API_KEY=<SUA_API_KEY>

# DATABASE_URL será criado automaticamente pelo Railway
```

## Passo 4: Configurar Google Calendar OAuth

1. Acesse https://console.cloud.google.com
2. Crie novo projeto "MB LifeOS"
3. Habilite "Google Calendar API"
4. Crie credenciais OAuth 2.0:
   - Tipo: Web application
   - Authorized redirect URIs: `https://app.mbanalytics.online/api/auth/google/callback`
5. Copie Client ID e Client Secret para as variáveis de ambiente do Railway

## Passo 5: Inicializar Banco de Dados

Após conectar o Railway:

```bash
# Conectar ao Railway
railway connect

# Executar script de inicialização
cd backend
node db-init.js
```

Ou via Railway CLI:
```bash
railway run node backend/db-init.js
```

## Passo 6: Deploy

```bash
# Fazer deploy
railway up

# Ou via dashboard Railway
# 1. Conecte seu repositório Git
# 2. Railway fará deploy automático
```

## Passo 7: Configurar Domínio

No Railway dashboard → Settings → Domains:
1. Clique "Add Domain"
2. Adicione `app.mbanalytics.online`
3. Configure DNS no seu registrador:
   - CNAME: `app.mbanalytics.online` → `<railway-domain>`

## Estrutura do Deploy

```
Railway Project
├── Backend (Node.js/Express)
│   ├── API endpoints
│   ├── Auth (JWT)
│   ├── Google Calendar OAuth
│   └── Anthropic AI proxy
├── PostgreSQL Database
│   ├── users
│   ├── user_data (22 módulos)
│   ├── oauth_tokens
│   └── backups
└── Frontend (React/Vite)
    └── Servido por Express em /
```

## Endpoints da API

### Autenticação
- `POST /api/auth/register` - Criar conta
- `POST /api/auth/login` - Login (retorna JWT)
- `GET /api/auth/me` - Dados do usuário logado
- `GET /api/auth/google` - URL de autorização OAuth
- `GET /api/auth/google/callback` - Callback OAuth

### Dados (CRUD)
- `GET /api/data` - Todos os módulos
- `GET /api/data/:module` - Um módulo específico
- `PUT /api/data/:module` - Salvar módulo
- `PUT /api/data` - Salvar todos os módulos

### Google Calendar
- `GET /api/calendar/status` - Status da conexão
- `GET /api/calendar/events?date=YYYY-MM-DD` - Listar eventos
- `POST /api/calendar/events` - Criar evento
- `PUT /api/calendar/events/:id` - Atualizar evento
- `DELETE /api/calendar/events/:id` - Deletar evento

### IA
- `POST /api/ai/insights` - Análises com Claude
- `POST /api/ai/ocr` - OCR de extratos bancários

### Backup
- `POST /api/backup` - Criar backup
- `GET /api/backup/list` - Listar backups
- `POST /api/backup/:id/restore` - Restaurar backup

## Módulos de Dados (22 total)

| Módulo | Descrição |
|--------|-----------|
| tasks | Tarefas com prioridade A/B/C e recorrência |
| notes | Notas com cards coloridos |
| projects | Projetos completos com fases e entregas |
| kanban | Board 4 colunas |
| purchases | Compras e importação |
| meetings | Pautas de reunião |
| matrix | Matriz Eisenhower |
| habits | Tracker 10 hábitos x 31 dias |
| finance | Financeiro com OCR de extratos |
| ideas | Brainstorm |
| health | Saúde (água, sono, energia, humor) |
| goals | Metas anuais e mensais |
| gaita | Acompanhamento aulas de gaita |
| films | Watchlist e histórico de filmes |
| books | Log de leituras com progresso |
| fishing | Diário de pesca |
| aquarium | Parâmetros, manutenção, inventário |
| newsClips | Clipping de notícias |
| accounts | Contas bancárias com saldo |
| cities | Cidades para relógio/clima |

## Usuário Inicial

Após o primeiro deploy:
1. Acesse `https://app.mbanalytics.online`
2. Clique em "Criar agora"
3. Registre-se com:
   - Email: `michelbedran@gmail.com`
   - Senha: (escolha uma segura)
   - Nome: Michel Bedran

## Migração de Dados

Para importar dados de um JSON existente:

1. Faça login na aplicação
2. No dashboard, clique em "Importar"
3. Selecione o arquivo JSON com os dados
4. Os dados serão carregados para o banco de dados

Ou via API:
```bash
curl -X PUT https://app.mbanalytics.online/api/data \
  -H "Authorization: Bearer <seu-token-jwt>" \
  -H "Content-Type: application/json" \
  -d @mb-lifeos-backup.json
```

## Troubleshooting

### Erro de conexão com banco de dados
- Verifique se PostgreSQL está rodando no Railway
- Confirme que `DATABASE_URL` está configurada
- Execute `railway run node backend/db-init.js` novamente

### Erro 401 Unauthorized
- Verifique se o token JWT está sendo enviado corretamente
- Confirme que `JWT_SECRET` está configurada

### Google Calendar não sincroniza
- Verifique se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão corretos
- Confirme que o redirect URI está correto no Google Cloud Console
- Verifique se o usuário autorizou o acesso ao Google Calendar

### Frontend não carrega
- Verifique se o build foi criado em `frontend/build/`
- Confirme que `FRONTEND_URL` está configurada corretamente
- Verifique os logs do Railway: `railway logs`

## Monitoramento

```bash
# Ver logs em tempo real
railway logs

# Ver status da aplicação
railway status

# Conectar ao banco de dados
railway connect

# Executar comando no Railway
railway run <comando>
```

## Próximos Passos

1. ✅ Deploy inicial
2. ✅ Configurar domínio
3. ✅ Testar autenticação
4. ✅ Sincronizar Google Calendar
5. ✅ Importar dados existentes
6. ✅ Configurar backups automáticos

## Suporte

Para problemas ou dúvidas:
- Documentação Railway: https://docs.railway.app
- Documentação Express: https://expressjs.com
- Documentação React: https://react.dev
