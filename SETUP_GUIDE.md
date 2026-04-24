# MB LifeOS - Guia Completo de Setup e Deploy

## 📋 Resumo Executivo

MB LifeOS é uma central de gestão de vida com 22 módulos integrados. Este guia orienta você através de:
1. Preparação do ambiente
2. Configuração do Google Calendar OAuth
3. Deploy no Railway
4. Migração de dados
5. Testes e validação

**Tempo estimado:** 30-45 minutos

---

## 🔧 Preparação do Ambiente

### Requisitos

- Node.js 18+ instalado
- npm ou yarn
- Conta Railway (https://railway.app)
- Domínio `app.mbanalytics.online` configurado
- Conta Google Cloud Console
- Chave da API Anthropic (opcional, para features de IA)

### Verificar Instalação

```bash
node --version  # v18.0.0 ou superior
npm --version   # 9.0.0 ou superior
```

---

## 🔐 Configurar Google Calendar OAuth

### Passo 1: Criar Projeto no Google Cloud Console

1. Acesse https://console.cloud.google.com
2. Clique em "Create Project"
3. Nome: `MB LifeOS`
4. Clique em "Create"

### Passo 2: Habilitar Google Calendar API

1. No console, vá para "APIs & Services" → "Library"
2. Procure por "Google Calendar API"
3. Clique em "Enable"

### Passo 3: Criar Credenciais OAuth

1. Vá para "APIs & Services" → "Credentials"
2. Clique em "Create Credentials" → "OAuth 2.0 Client IDs"
3. Se solicitado, configure a "OAuth consent screen" primeiro:
   - User Type: External
   - App name: MB LifeOS
   - User support email: seu@email.com
   - Developer contact: seu@email.com
4. Volte para Credentials e clique em "Create Credentials" → "OAuth 2.0 Client IDs"
5. Tipo de aplicação: "Web application"
6. Nome: MB LifeOS
7. Authorized redirect URIs: `https://app.mbanalytics.online/api/auth/google/callback`
8. Clique em "Create"

### Passo 4: Salvar Credenciais

Na tela de credenciais, você verá:
- **Client ID** - Copie este valor
- **Client Secret** - Copie este valor

Guarde esses valores para o próximo passo.

---

## 🚀 Deploy no Railway

### Passo 1: Instalar Railway CLI

```bash
npm install -g @railway/cli
```

### Passo 2: Fazer Login no Railway

```bash
railway login
```

Você será redirecionado para o navegador para autenticar.

### Passo 3: Criar Projeto

```bash
cd /home/ubuntu/mb-lifeos
railway init
```

Siga as instruções:
- Project name: `mb-lifeos`
- Environment: `production`

### Passo 4: Adicionar PostgreSQL

No dashboard do Railway (https://railway.app):

1. Clique no seu projeto `mb-lifeos`
2. Clique em "Create" → "Database" → "PostgreSQL"
3. Railway criará automaticamente a variável `DATABASE_URL`

Aguarde 1-2 minutos para o banco estar pronto.

### Passo 5: Configurar Variáveis de Ambiente

No dashboard do Railway, clique em "Variables" e adicione:

#### Gerar JWT_SECRET

Execute no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado (será uma string de 64 caracteres).

#### Adicionar Variáveis

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://app.mbanalytics.online` |
| `PORT` | `3001` |
| `JWT_SECRET` | (Cole a string gerada acima) |
| `GOOGLE_CLIENT_ID` | (Do Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | (Do Google Cloud Console) |
| `GOOGLE_REDIRECT_URI` | `https://app.mbanalytics.online/api/auth/google/callback` |
| `ANTHROPIC_API_KEY` | (Opcional - sua chave da API Anthropic) |

**Nota:** `DATABASE_URL` será criado automaticamente pelo Railway.

### Passo 6: Inicializar Banco de Dados

No terminal:

```bash
# Conectar ao Railway
railway connect

# Executar script de inicialização
cd backend
node db-init.js
```

Você verá:
```
✓ Database initialized successfully
✓ Tables created
✓ Ready for deployment
```

### Passo 7: Deploy

```bash
# Fazer deploy
railway up
```

Railway fará:
1. Build do projeto
2. Instalação de dependências
3. Build do frontend
4. Inicialização do servidor

Aguarde 5-10 minutos. Você verá:
```
✓ Deployment successful
✓ Application running at: https://app.mbanalytics.online
```

### Passo 8: Configurar Domínio

No dashboard do Railway:

1. Clique em seu projeto
2. Vá para "Settings" → "Domains"
3. Clique em "Add Domain"
4. Adicione `app.mbanalytics.online`
5. Railway fornecerá um CNAME

Configure no seu registrador de domínio:
- Tipo: CNAME
- Nome: `app`
- Valor: (fornecido pelo Railway)

Aguarde 5-30 minutos para propagação do DNS.

---

## 📊 Testar a Aplicação

### Teste 1: Acessar a Aplicação

1. Acesse https://app.mbanalytics.online
2. Você deve ver a tela de login

### Teste 2: Criar Conta

1. Clique em "Criar agora"
2. Preencha:
   - Nome: Michel Bedran
   - Email: michelbedran@gmail.com
   - Senha: (escolha uma segura)
3. Clique em "Criar Conta"
4. Você deve ser redirecionado para o dashboard

### Teste 3: Sincronizar Google Calendar

1. No dashboard, clique em "Sync Calendar"
2. Você será redirecionado para autorizar o acesso ao Google Calendar
3. Clique em "Allow"
4. Você será redirecionado de volta
5. Os eventos do seu Google Calendar devem aparecer

### Teste 4: Criar Tarefa

1. Clique em "Diário"
2. Clique em "Adicionar Tarefa"
3. Preencha os dados
4. Clique em "Salvar"
5. A tarefa deve aparecer na lista

---

## 📥 Migração de Dados

Se você tem dados existentes em JSON:

### Via Interface Web

1. Faça login em https://app.mbanalytics.online
2. No sidebar, clique em "Importar"
3. Selecione o arquivo JSON
4. Os dados serão carregados

### Via API

```bash
# Obter token JWT
TOKEN=$(curl -X POST https://app.mbanalytics.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"michelbedran@gmail.com","password":"sua-senha"}' \
  | jq -r '.token')

# Importar dados
curl -X PUT https://app.mbanalytics.online/api/data \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @mb-lifeos-backup.json
```

---

## 🔍 Monitoramento e Troubleshooting

### Ver Logs

```bash
railway logs
```

### Conectar ao Banco de Dados

```bash
railway connect
```

Você pode então executar comandos SQL:
```sql
SELECT * FROM users;
SELECT * FROM user_data WHERE module = 'tasks';
```

### Problemas Comuns

#### Erro: "Database connection failed"
- Verifique se PostgreSQL está rodando no Railway
- Confirme que `DATABASE_URL` está configurada
- Execute novamente: `railway run node backend/db-init.js`

#### Erro: "Invalid credentials"
- Verifique email e senha
- Confirme que a conta foi criada corretamente

#### Google Calendar não sincroniza
- Verifique se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão corretos
- Confirme que o redirect URI está correto no Google Cloud Console
- Tente fazer logout e login novamente

#### Domínio não funciona
- Verifique se o CNAME foi configurado corretamente
- Aguarde propagação do DNS (até 48 horas)
- Use `nslookup app.mbanalytics.online` para verificar

---

## 📚 Estrutura dos Módulos

A aplicação possui 22 módulos de dados:

**Planejamento:**
- Dashboard - Visão geral
- Anual - Planejamento anual
- Mensal - Planejamento mensal
- Semanal - Planejamento semanal
- Diário - Planejamento diário
- Tarefas - Lista de tarefas
- Eisenhower - Matriz de priorização

**Trabalho:**
- Projetos - Gestão de projetos
- Kanban - Board de tarefas
- Compras - Gestão de compras
- Reuniões - Pautas de reunião

**Pessoal:**
- Hábitos - Rastreamento de hábitos
- Financeiro - Gestão financeira com OCR
- Saúde - Rastreamento de saúde
- Gaita - Acompanhamento de aulas

**Vida & Hobbies:**
- Filmes - Watchlist e histórico
- Livros - Log de leituras
- Pescaria - Diário de pesca
- Aquário - Parâmetros e manutenção
- Notícias - Clipping de notícias
- Brainstorm - Ideias

---

## 🔐 Segurança

### Boas Práticas

1. **Senhas:** Use senhas fortes (mínimo 8 caracteres)
2. **Tokens:** Nunca compartilhe seu JWT token
3. **API Keys:** Mantenha suas chaves de API seguras
4. **Backups:** Faça backups regulares dos seus dados

### Backup Automático

A aplicação cria backups automáticos:
1. Cada vez que você salva dados
2. Antes de qualquer alteração importante

Para restaurar:
1. Clique em "Recuperar dados"
2. Selecione o backup desejado
3. Clique em "Restaurar"

---

## 📞 Suporte

- **Documentação Railway:** https://docs.railway.app
- **Documentação Express:** https://expressjs.com
- **Documentação React:** https://react.dev
- **Documentação PostgreSQL:** https://www.postgresql.org/docs/

---

## ✅ Checklist de Deploy

- [ ] Node.js 18+ instalado
- [ ] Conta Railway criada
- [ ] Domínio `app.mbanalytics.online` configurado
- [ ] Google Cloud Console project criado
- [ ] Google Calendar API habilitada
- [ ] OAuth credentials criadas
- [ ] Railway CLI instalado
- [ ] Projeto Railway criado
- [ ] PostgreSQL adicionado ao Railway
- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados inicializado
- [ ] Deploy realizado com sucesso
- [ ] Domínio configurado no Railway
- [ ] Aplicação acessível em https://app.mbanalytics.online
- [ ] Conta de teste criada
- [ ] Google Calendar sincronizado
- [ ] Dados importados (se aplicável)

---

**Parabéns! Sua aplicação MB LifeOS está pronta para uso! 🎉**
