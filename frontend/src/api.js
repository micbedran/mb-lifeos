// MB LifeOS - API Client
// Replaces window.storage with server API calls

const API_BASE = window.location.origin + '/api';

let authToken = localStorage.getItem('mb-lifeos-token');

function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('mb-lifeos-token', token);
  else localStorage.removeItem('mb-lifeos-token');
}

function getToken() {
  return authToken;
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    setToken(null);
    window.location.reload();
    return null;
  }
  return res.json();
}

// ─── Auth ───
export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (data?.token) setToken(data.token);
  return data;
}

export async function register(email, password, name) {
  const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
  if (data?.token) setToken(data.token);
  return data;
}

export async function getMe() {
  return api('/auth/me');
}

export function logout() {
  setToken(null);
  window.location.reload();
}

export function isAuthenticated() {
  return !!getToken();
}

// ─── Data CRUD (replaces window.storage) ───
export async function loadAllData() {
  return api('/data');
}

export async function loadModule(module) {
  return api(`/data/${module}`);
}

export async function saveModule(module, data) {
  return api(`/data/${module}`, { method: 'PUT', body: JSON.stringify({ data }) });
}

export async function saveAllData(allData) {
  return api('/data', { method: 'PUT', body: JSON.stringify(allData) });
}

// ─── Backup ───
export async function createBackup() {
  return api('/backup', { method: 'POST' });
}

export async function listBackups() {
  return api('/backup/list');
}

export async function restoreBackup(backupId) {
  return api(`/backup/${backupId}/restore`, { method: 'POST' });
}

// ─── Google Calendar ───
export async function getGoogleAuthUrl() {
  return api('/auth/google');
}

export async function getCalendarStatus() {
  return api('/calendar/status');
}

export async function fetchCalendarEvents(date) {
  return api(`/calendar/events?date=${date}`);
}

export async function createCalendarEvent(event) {
  return api('/calendar/events', { method: 'POST', body: JSON.stringify(event) });
}

export async function updateCalendarEvent(eventId, updates) {
  return api(`/calendar/events/${eventId}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function deleteCalendarEvent(eventId) {
  return api(`/calendar/events/${eventId}`, { method: 'DELETE' });
}

// ─── AI Features ───
export async function aiInsights(prompt) {
  return api('/ai/insights', { method: 'POST', body: JSON.stringify({ prompt }) });
}

export async function aiOCR(imageBase64, bank) {
  return api('/ai/ocr', { method: 'POST', body: JSON.stringify({ image: imageBase64, bank }) });
}
