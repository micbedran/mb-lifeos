require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Database ───
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// ─── Middleware ───
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/build')));

// ─── Auth Middleware ───
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// ─── Auth Routes ───
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hash, name || 'Usuário']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    // Initialize all modules with empty data
    const modules = ['tasks','notes','projects','kanban','purchases','meetings','matrix','habits','finance','ideas','health','goals','gaita','films','books','fishing','aquarium','newsClips','accounts','cities'];
    for (const mod of modules) {
      await pool.query('INSERT INTO user_data (user_id, module, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [user.id, mod, '[]']);
    }

    res.json({ token, user });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Data CRUD (Generic for all modules) ───
// GET /api/data/:module - Get module data
app.get('/api/data/:module', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM user_data WHERE user_id = $1 AND module = $2', [req.user.id, req.params.module]);
    res.json(result.rows[0]?.data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/data/:module - Save module data (full replace)
app.put('/api/data/:module', authMiddleware, async (req, res) => {
  try {
    const { data } = req.body;
    await pool.query(
      `INSERT INTO user_data (user_id, module, data, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, module) DO UPDATE SET data = $3, updated_at = NOW()`,
      [req.user.id, req.params.module, JSON.stringify(data)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/data - Get ALL modules at once (for initial load)
app.get('/api/data', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT module, data FROM user_data WHERE user_id = $1', [req.user.id]);
    const allData = {};
    result.rows.forEach(r => { allData[r.module] = r.data; });
    res.json(allData);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/data - Save ALL modules at once (for bulk save)
app.put('/api/data', authMiddleware, async (req, res) => {
  try {
    const modules = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [mod, data] of Object.entries(modules)) {
        await client.query(
          `INSERT INTO user_data (user_id, module, data, updated_at) VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, module) DO UPDATE SET data = $3, updated_at = NOW()`,
          [req.user.id, mod, JSON.stringify(data)]
        );
      }
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Backup/Export/Import ───
app.post('/api/backup', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT module, data FROM user_data WHERE user_id = $1', [req.user.id]);
    const allData = {};
    result.rows.forEach(r => { allData[r.module] = r.data; });
    // Save backup
    await pool.query('INSERT INTO backups (user_id, data) VALUES ($1, $2)', [req.user.id, JSON.stringify(allData)]);
    res.json(allData);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/backup/list', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, created_at FROM backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [req.user.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/backup/:id/restore', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM backups WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Backup not found' });
    const data = result.rows[0].data;
    // Restore all modules
    for (const [mod, modData] of Object.entries(data)) {
      await pool.query(
        `INSERT INTO user_data (user_id, module, data, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, module) DO UPDATE SET data = $3, updated_at = NOW()`,
        [req.user.id, mod, JSON.stringify(modData)]
      );
    }
    res.json({ ok: true, modules: Object.keys(data).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Google Calendar OAuth ───
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.get('/api/auth/google', authMiddleware, (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: req.user.id,
  });
  res.json({ url });
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    await pool.query(
      `INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, token_expiry, scope)
       VALUES ($1, 'google', $2, $3, $4, $5)
       ON CONFLICT (user_id, provider) DO UPDATE SET
         access_token = $2, refresh_token = COALESCE($3, oauth_tokens.refresh_token),
         token_expiry = $4, scope = $5, updated_at = NOW()`,
      [userId, tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date), tokens.scope]
    );
    res.redirect(process.env.FRONTEND_URL + '?google=connected');
  } catch (e) { res.redirect(process.env.FRONTEND_URL + '?google=error&msg=' + e.message); }
});

// Helper: get authenticated calendar client
async function getCalendarClient(userId) {
  const result = await pool.query('SELECT * FROM oauth_tokens WHERE user_id = $1 AND provider = $2', [userId, 'google']);
  const token = result.rows[0];
  if (!token) throw new Error('Google Calendar not connected');

  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  auth.setCredentials({ access_token: token.access_token, refresh_token: token.refresh_token, expiry_date: new Date(token.token_expiry).getTime() });

  // Auto-refresh if expired
  if (new Date(token.token_expiry) < new Date()) {
    const { credentials } = await auth.refreshAccessToken();
    await pool.query(
      'UPDATE oauth_tokens SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE user_id = $3 AND provider = $4',
      [credentials.access_token, new Date(credentials.expiry_date), userId, 'google']
    );
  }

  return google.calendar({ version: 'v3', auth });
}

// ─── Calendar API Routes ───
app.get('/api/calendar/events', authMiddleware, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.query;
    const calendar = await getCalendarClient(req.user.id);
    const start = startTime || `${date}T00:00:00-03:00`;
    const end = endTime || `${date}T23:59:59-03:00`;
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start,
      timeMax: end,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Sao_Paulo',
    });
    res.json(response.data.items || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendar/events', authMiddleware, async (req, res) => {
  try {
    const { summary, startTime, endTime, description, location, recurrence, reminders } = req.body;
    const calendar = await getCalendarClient(req.user.id);
    const event = {
      summary,
      description,
      location,
      start: { dateTime: startTime, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: endTime, timeZone: 'America/Sao_Paulo' },
    };
    if (recurrence) event.recurrence = [recurrence];
    if (reminders) event.reminders = { useDefault: false, overrides: [{ method: 'popup', minutes: parseInt(reminders) }] };
    const response = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
    res.json(response.data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/calendar/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const calendar = await getCalendarClient(req.user.id);
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: req.params.eventId,
      requestBody: req.body,
    });
    res.json(response.data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/calendar/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const calendar = await getCalendarClient(req.user.id);
    await calendar.events.delete({ calendarId: 'primary', eventId: req.params.eventId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/calendar/status', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id FROM oauth_tokens WHERE user_id = $1 AND provider = $2', [req.user.id, 'google']);
    res.json({ connected: result.rows.length > 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── AI Features (Anthropic API proxy) ───
app.post('/api/ai/insights', authMiddleware, async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/ocr', authMiddleware, async (req, res) => {
  try {
    const { image, bank } = req.body; // base64 image
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } },
            { type: 'text', text: `Analise este extrato bancário (${bank}) e extraia TODAS as transações. Retorne APENAS JSON: [{"date":"YYYY-MM-DD","desc":"descrição","value":99.99,"type":"saida ou entrada"}]` }
          ]
        }],
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SPA Fallback ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// ─── Start ───
app.listen(PORT, () => {
  console.log(`MB LifeOS API running on port ${PORT}`);
});
