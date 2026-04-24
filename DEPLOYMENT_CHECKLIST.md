# MB LifeOS - Deployment Checklist

## ✅ Preparação Completa

### Frontend
- [x] App.jsx adaptado para usar api.js
- [x] Removidas constantes GCAL_MCP e API_URL
- [x] Funções de Google Calendar adaptadas
- [x] Tela de Login/Register implementada
- [x] Build realizado com Vite (316 KB)
- [x] Arquivo build/index.html criado

### Backend
- [x] Dependências instaladas
- [x] API Express configurada
- [x] Autenticação JWT implementada
- [x] Google Calendar OAuth pronto
- [x] Anthropic AI proxy configurado
- [x] Backup/restore implementado

### Banco de Dados
- [x] Schema SQL criado
- [x] Script db-init.js pronto
- [x] 22 módulos de dados definidos
- [x] Índices otimizados

### Configuração
- [x] railway.toml configurado
- [x] .env.production template criado
- [x] Variáveis de ambiente documentadas

### Documentação
- [x] SETUP_GUIDE.md - Guia passo a passo
- [x] DEPLOY_RAILWAY.md - Instruções detalhadas
- [x] README_DEPLOY.md - Quick start
- [x] DEPLOYMENT_CHECKLIST.md - Este arquivo

---

## 🚀 Próximos Passos (Para Você Executar)

### Passo 1: Google Cloud Console Setup
- [ ] Acesse https://console.cloud.google.com
- [ ] Crie projeto "MB LifeOS"
- [ ] Habilite Google Calendar API
- [ ] Crie OAuth 2.0 credentials
- [ ] Adicione redirect URI: `https://app.mbanalytics.online/api/auth/google/callback`
- [ ] Copie Client ID e Client Secret

### Passo 2: Railway Setup
- [ ] Instale Railway CLI: `npm install -g @railway/cli`
- [ ] Faça login: `railway login`
- [ ] Crie projeto: `railway init`
- [ ] Adicione PostgreSQL plugin
- [ ] Configure variáveis de ambiente

### Passo 3: Variáveis de Ambiente
- [ ] Gere JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Adicione NODE_ENV=production
- [ ] Adicione FRONTEND_URL=https://app.mbanalytics.online
- [ ] Adicione GOOGLE_CLIENT_ID
- [ ] Adicione GOOGLE_CLIENT_SECRET
- [ ] Adicione GOOGLE_REDIRECT_URI
- [ ] Adicione ANTHROPIC_API_KEY (opcional)

### Passo 4: Deploy
- [ ] Execute: `railway up`
- [ ] Aguarde 5-10 minutos
- [ ] Verifique logs: `railway logs`

### Passo 5: Configurar Domínio
- [ ] No Railway dashboard, vá para Settings → Domains
- [ ] Adicione `app.mbanalytics.online`
- [ ] Copie o CNAME fornecido
- [ ] Configure CNAME no seu registrador de domínio
- [ ] Aguarde propagação DNS (até 48 horas)

### Passo 6: Inicializar Banco de Dados
- [ ] Execute: `railway run node backend/db-init.js`
- [ ] Verifique se as tabelas foram criadas

### Passo 7: Testar
- [ ] Acesse https://app.mbanalytics.online
- [ ] Crie conta de teste
- [ ] Teste sincronização de Google Calendar
- [ ] Teste criação de tarefas
- [ ] Teste export/import de dados

### Passo 8: Migração de Dados (se aplicável)
- [ ] Prepare arquivo JSON com dados existentes
- [ ] Faça login na aplicação
- [ ] Clique em "Importar"
- [ ] Selecione arquivo JSON
- [ ] Verifique se os dados foram importados

---

## 📋 Arquivos Importantes

### Documentação
- `SETUP_GUIDE.md` - Leia primeiro! Guia completo passo a passo
- `DEPLOY_RAILWAY.md` - Instruções detalhadas de deploy
- `README_DEPLOY.md` - Quick start
- `README.md` - Documentação original da arquitetura

### Configuração
- `railway.toml` - Configuração do Railway
- `deploy/.env.example` - Exemplo de variáveis
- `deploy/.env.production` - Template para produção
- `deploy/schema.sql` - Schema PostgreSQL

### Código
- `frontend/src/App.jsx` - ✅ Adaptado para api.js
- `frontend/src/api.js` - Cliente API
- `backend/server.js` - API Express
- `backend/db-init.js` - Inicialização do banco

---

## 🔑 Credenciais Necessárias

Você precisará de:

1. **Google Cloud Console**
   - Client ID
   - Client Secret

2. **Anthropic (Opcional)**
   - API Key

3. **Railway**
   - Conta criada
   - Projeto criado
   - PostgreSQL adicionado

4. **Domínio**
   - `app.mbanalytics.online` configurado

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs: `railway logs`
2. Conecte ao banco: `railway connect`
3. Leia a documentação relevante
4. Consulte:
   - Railway Docs: https://docs.railway.app
   - Express Docs: https://expressjs.com
   - PostgreSQL Docs: https://www.postgresql.org/docs/

---

## ✨ Resumo

A aplicação MB LifeOS está **100% preparada para deploy**:

- ✅ Frontend adaptado e buildado
- ✅ Backend pronto
- ✅ Banco de dados configurado
- ✅ Documentação completa
- ✅ Variáveis de ambiente documentadas
- ✅ Railway configurado

**Tempo estimado para deploy:** 30-45 minutos

**Status:** 🟢 Pronto para Deploy

---

**Última atualização:** 24/04/2026
**Versão:** 1.0.0
**Desenvolvido para:** Michel Bedran
