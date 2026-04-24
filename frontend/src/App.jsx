import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api";

// ─── Persistent Storage helpers ───
const store = {
  async get(k) { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  async set(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch(e) { console.error(e); } },
};

// ─── Date helpers ───
const pad = n => String(n).padStart(2, "0");
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDateBR = d => `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
const dayNames = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const dayNamesShort = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; }
function getWeekDays(d) { const s = startOfWeek(d); return Array.from({length:7}, (_,i) => addDays(s, i)); }

async function fetchEvents(dateStr) {
  try {
    const events = await api.fetchCalendarEvents(dateStr);
    return { results: "", text: "", raw: events || [] };
  } catch (e) {
    console.error("Calendar fetch error:", e);
    return { results: "", text: "Erro ao buscar eventos", raw: [] };
  }
}

// Recurrence options
const RECURRENCE_OPTIONS = [
  { value: "", label: "Nao repete" },
  { value: "DAILY", label: "Diariamente" },
  { value: "WEEKDAYS", label: "Dias uteis (Seg-Sex)" },
  { value: "WEEKLY", label: "Semanalmente" },
  { value: "BIWEEKLY", label: "Quinzenalmente" },
  { value: "MONTHLY", label: "Mensalmente" },
  { value: "YEARLY", label: "Anualmente" },
];

function recurrenceToRRule(value, dayOfWeek) {
  const map = {
    "DAILY": "RRULE:FREQ=DAILY",
    "WEEKDAYS": "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "WEEKLY": "RRULE:FREQ=WEEKLY",
    "BIWEEKLY": "RRULE:FREQ=WEEKLY;INTERVAL=2",
    "MONTHLY": "RRULE:FREQ=MONTHLY",
    "YEARLY": "RRULE:FREQ=YEARLY",
  };
  return map[value] || "";
}

function recurrenceLabel(value) {
  return RECURRENCE_OPTIONS.find(o => o.value === value)?.label || "";
}

// Generate next occurrence date for recurring tasks
function nextOccurrence(dateStr, recurrence) {
  const d = new Date(dateStr + "T12:00:00");
  switch (recurrence) {
    case "DAILY": d.setDate(d.getDate() + 1); break;
    case "WEEKDAYS":
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY": d.setDate(d.getDate() + 7); break;
    case "BIWEEKLY": d.setDate(d.getDate() + 14); break;
    case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
    case "YEARLY": d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }
  return fmtDate(d);
}

async function createEvent(title, date, startTime, endTime, description, location, reminder, recurrence) {
  try {
    const event = {
      summary: title,
      startTime: `${date}T${startTime}:00`,
      endTime: `${date}T${endTime}:00`,
      description,
      location,
      reminders: reminder ? [{ minutes: parseInt(reminder), method: "popup" }] : [],
      recurrence: recurrence ? [recurrenceToRRule(recurrence)] : [],
    };
    return await api.createCalendarEvent(event);
  } catch (e) {
    console.error("Create event error:", e);
    return null;
  }
}

async function updateEvent(eventId, updates) {
  try {
    return await api.updateCalendarEvent(eventId, updates);
  } catch (e) {
    console.error("Update event error:", e);
    return null;
  }
}

async function deleteEvent(eventId) {
  try {
    return await api.deleteCalendarEvent(eventId);
  } catch (e) {
    console.error("Delete event error:", e);
    return null;
  }
}

// ─── Icons (inline SVG) ───
const Icons = {
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  day: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  week: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="9" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  note: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  sync: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  chevL: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
  chevR: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  mapPin: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  text: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>,
  bell: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

// ─── Event Detail Panel ───
function EventDetailPanel({ event, onClose, onDelete, dateStr }) {
  const [deleting, setDeleting] = useState(false);

  if (!event) return null;

  const handleDelete = async () => {
    setDeleting(true);
    await deleteEvent(event.id);
    setDeleting(false);
    onDelete();
  };

  const mapUrl = event.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : null;
  const calUrl = event.htmlLink || null;

  const InfoRow = ({ icon, label, children }) => (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ color: theme.textMuted, flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: theme.font, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 400, height: "100vh", background: theme.bgCard, borderLeft: `1px solid ${theme.border}`, zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.4)" }} className="fade-in">
      {/* Header */}
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: theme.accent }} />
            <Badge>{event.status || "confirmed"}</Badge>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, fontFamily: theme.fontSans, lineHeight: 1.3 }}>{event.title}</h3>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", padding: 4 }}>{Icons.x}</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 20px" }}>
        <InfoRow icon={Icons.clock} label="Horário">
          {event.time || "Dia todo"}
        </InfoRow>

        {event.location && (
          <InfoRow icon={Icons.mapPin} label="Local">
            <div>{event.location}</div>
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: theme.accent, fontSize: 12, marginTop: 6, textDecoration: "none", padding: "4px 10px", background: theme.accentBg, borderRadius: 4 }}>
                {Icons.mapPin} Abrir no Google Maps
              </a>
            )}
          </InfoRow>
        )}

        {event.description && (
          <InfoRow icon={Icons.text} label="Descrição / Observações">
            <div style={{ whiteSpace: "pre-wrap" }}>{event.description}</div>
          </InfoRow>
        )}

        {event.organizer && (
          <InfoRow icon={Icons.user} label="Organizador">
            {event.organizer}
          </InfoRow>
        )}

        {event.attendees && event.attendees.length > 0 && (
          <InfoRow icon={Icons.user} label="Participantes">
            {event.attendees.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.status === "accepted" ? theme.green : a.status === "declined" ? theme.red : theme.amber }} />
                <span>{a.email || a}</span>
              </div>
            ))}
          </InfoRow>
        )}

        {event.reminders && (
          <InfoRow icon={Icons.bell} label="Lembretes">
            {event.reminders}
          </InfoRow>
        )}

        {event.recurrence && (
          <InfoRow icon={Icons.sync} label="Recorrência">
            {event.recurrence}
          </InfoRow>
        )}

        {calUrl && (
          <InfoRow icon={Icons.link} label="Link">
            <a href={calUrl} target="_blank" rel="noopener" style={{ color: theme.accent, fontSize: 12, textDecoration: "none" }}>
              Abrir no Google Calendar
            </a>
          </InfoRow>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${theme.border}`, display: "flex", gap: 8 }}>
        {calUrl && <Btn small variant="default" onClick={() => window.open(calUrl, "_blank")} style={{ flex: 1 }}>{Icons.edit} Editar no Calendar</Btn>}
        <Btn small variant="danger" onClick={handleDelete} disabled={deleting} style={{ flex: calUrl ? 0 : 1 }}>
          {Icons.trash} {deleting ? "Excluindo..." : "Excluir"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Styles ───
const theme = {
  bg: "#0f1117", bgCard: "#1a1d27", bgHover: "#252836", bgInput: "#1e2130",
  border: "#2a2d3a", borderLight: "#353849",
  accent: "#6c63ff", accentHover: "#7b73ff", accentBg: "rgba(108,99,255,0.12)",
  green: "#4ade80", greenBg: "rgba(74,222,128,0.12)",
  amber: "#fbbf24", amberBg: "rgba(251,191,36,0.12)",
  red: "#f87171", redBg: "rgba(248,113,113,0.12)",
  text: "#e4e4e7", textMuted: "#9ca3af", textDim: "#6b7280",
  font: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  fontSans: "'Inter', -apple-system, sans-serif",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
  input, textarea, select { font-family: ${theme.fontSans}; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fade-in { animation: fadeIn 0.3s ease; }
  .loading { animation: spin 1s linear infinite; }
`;

// ─── Components ───
function Badge({ children, color = "accent" }) {
  const colors = { accent: { bg: theme.accentBg, text: theme.accent }, green: { bg: theme.greenBg, text: theme.green }, amber: { bg: theme.amberBg, text: theme.amber }, red: { bg: theme.redBg, text: theme.red } };
  const c = colors[color] || colors.accent;
  return <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: theme.font }}>{children}</span>;
}

function Btn({ children, onClick, variant = "default", small, style: st, disabled }) {
  const base = { display:"inline-flex", alignItems:"center", gap: 6, padding: small ? "5px 10px" : "8px 16px", borderRadius: 6, border: "none", cursor: disabled ? "default" : "pointer", fontSize: small ? 12 : 13, fontWeight: 500, fontFamily: theme.fontSans, transition: "all 0.15s", opacity: disabled ? 0.5 : 1 };
  const variants = {
    default: { background: theme.bgHover, color: theme.text, border: `1px solid ${theme.border}` },
    primary: { background: theme.accent, color: "#fff" },
    ghost: { background: "transparent", color: theme.textMuted },
    danger: { background: theme.redBg, color: theme.red },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...st }}>{children}</button>;
}

function Input({ value, onChange, placeholder, style: st, ...props }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, fontFamily: theme.fontSans, width: "100%", outline: "none", ...st }} {...props} />;
}

// ─── Weather & City Clock Widget ───
const CITY_LIST = [
  { group: "BRASIL", cities: [
    { name: "Araraquara", tz: "America/Sao_Paulo" },{ name: "São Paulo", tz: "America/Sao_Paulo" },
    { name: "Sorocaba", tz: "America/Sao_Paulo" },{ name: "Campinas", tz: "America/Sao_Paulo" },
    { name: "Ribeirão Preto", tz: "America/Sao_Paulo" },{ name: "Bauru", tz: "America/Sao_Paulo" },
    { name: "São José do Rio Preto", tz: "America/Sao_Paulo" },{ name: "Marília", tz: "America/Sao_Paulo" },
    { name: "Presidente Prudente", tz: "America/Sao_Paulo" },{ name: "Santos", tz: "America/Sao_Paulo" },
    { name: "Rio de Janeiro", tz: "America/Sao_Paulo" },{ name: "Belo Horizonte", tz: "America/Sao_Paulo" },
    { name: "Curitiba", tz: "America/Sao_Paulo" },{ name: "Porto Alegre", tz: "America/Sao_Paulo" },
    { name: "Florianópolis", tz: "America/Sao_Paulo" },{ name: "Brasília", tz: "America/Sao_Paulo" },
    { name: "Salvador", tz: "America/Bahia" },{ name: "Recife", tz: "America/Recife" },
    { name: "Fortaleza", tz: "America/Fortaleza" },{ name: "Belém", tz: "America/Belem" },
    { name: "Manaus", tz: "America/Manaus" },{ name: "Goiânia", tz: "America/Sao_Paulo" },
    { name: "Campo Grande", tz: "America/Campo_Grande" },{ name: "Cuiabá", tz: "America/Cuiaba" },
    { name: "Vitória", tz: "America/Sao_Paulo" },{ name: "Natal", tz: "America/Fortaleza" },
    { name: "João Pessoa", tz: "America/Fortaleza" },{ name: "Maceió", tz: "America/Maceio" },
    { name: "Aracaju", tz: "America/Maceio" },{ name: "São Luís", tz: "America/Fortaleza" },
    { name: "Teresina", tz: "America/Fortaleza" },{ name: "Palmas", tz: "America/Sao_Paulo" },
    { name: "Porto Velho", tz: "America/Porto_Velho" },{ name: "Rio Branco", tz: "America/Rio_Branco" },
    { name: "Macapá", tz: "America/Belem" },{ name: "Boa Vista", tz: "America/Boa_Vista" },
  ]},
  { group: "ÁSIA", cities: [
    { name: "Xangai", tz: "Asia/Shanghai" },{ name: "Pequim", tz: "Asia/Shanghai" },
    { name: "Shenzhen", tz: "Asia/Shanghai" },{ name: "Guangzhou", tz: "Asia/Shanghai" },
    { name: "Hong Kong", tz: "Asia/Hong_Kong" },{ name: "Tóquio", tz: "Asia/Tokyo" },
    { name: "Seul", tz: "Asia/Seoul" },{ name: "Mumbai", tz: "Asia/Kolkata" },
    { name: "Singapura", tz: "Asia/Singapore" },{ name: "Dubai", tz: "Asia/Dubai" },
    { name: "Bangkok", tz: "Asia/Bangkok" },{ name: "Taipei", tz: "Asia/Taipei" },
  ]},
  { group: "AMÉRICAS", cities: [
    { name: "Nova York", tz: "America/New_York" },{ name: "Los Angeles", tz: "America/Los_Angeles" },
    { name: "Miami", tz: "America/New_York" },{ name: "Chicago", tz: "America/Chicago" },
    { name: "Toronto", tz: "America/Toronto" },{ name: "Cidade do México", tz: "America/Mexico_City" },
    { name: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" },{ name: "Santiago", tz: "America/Santiago" },
    { name: "Lima", tz: "America/Lima" },{ name: "Bogotá", tz: "America/Bogota" },
  ]},
  { group: "EUROPA", cities: [
    { name: "Londres", tz: "Europe/London" },{ name: "Paris", tz: "Europe/Paris" },
    { name: "Berlim", tz: "Europe/Berlin" },{ name: "Madri", tz: "Europe/Madrid" },
    { name: "Roma", tz: "Europe/Rome" },{ name: "Lisboa", tz: "Europe/Lisbon" },
    { name: "Amsterdã", tz: "Europe/Amsterdam" },{ name: "Moscou", tz: "Europe/Moscow" },
  ]},
];
const ALL_CITIES = CITY_LIST.flatMap(g => g.cities);

function WeatherClock({ cities, setCities }) {
  const [time, setTime] = useState(Date.now());
  const [weather, setWeather] = useState({});
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => { const t = setInterval(() => setTime(Date.now()), 30000); return () => clearInterval(t); }, []);

  const fetchWeatherRef = useRef(null);

  // Auto-fetch weather on mount  
  useEffect(() => { 
    const timer = setTimeout(() => { if (fetchWeatherRef.current) fetchWeatherRef.current(); }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-detect location for City 1
  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 100,
          messages: [{ role: "user", content: `Coordinates: ${pos.coords.latitude}, ${pos.coords.longitude}. What is the city name in Portuguese? Reply ONLY with the city name, nothing else.` }]
        }) });
        const data = await res.json();
        const cityName = data.content?.[0]?.text?.trim() || "Minha cidade";
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setCities(prev => [{ name: cityName, tz, auto: true }, prev[1]]);
      } catch { /* keep current */ }
      setLocating(false);
    }, () => setLocating(false));
  };

  const getTime = (tz) => {
    try { return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()); }
    catch { return "--:--"; }
  };
  const getDateStr = (tz) => {
    try { return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date()); }
    catch { return ""; }
  };

  const fetchWeather = async () => {
    setLoadingWeather(true);
    try {
      const cityNames = cities.map(c => c.name).join(" e ");
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 300,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: `Qual a temperatura e condição climática AGORA em ${cityNames}? Responda APENAS em JSON: [{"city":"nome","temp":"XX°C","condition":"condição","humidity":"XX%"}]. Sem explicações.` }]
      }) });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const w = {};
        // Store by lowercase name and also by index as fallback
        parsed.forEach((p, idx) => { 
          if (p.city) w[p.city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] = p;
          if (p.city) w[p.city.toLowerCase()] = p;
          // Fallback: assign by order to cities
          if (idx < cities.length) w[cities[idx].name.toLowerCase()] = p;
        });
        setWeather(w);
      }
    } catch (e) { console.error("Weather error:", e); }
    setLoadingWeather(false);
  };
  fetchWeatherRef.current = fetchWeather;

  const setCity = (idx, cityObj) => {
    setCities(prev => prev.map((c, i) => i === idx ? { ...cityObj, auto: idx === 0 ? c.auto : false } : c));
  };

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      {cities.map((city, i) => {
        const w = weather[city.name?.toLowerCase()] || weather[city.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || {};
        return (
          <div key={i} style={{ flex: 1, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {i === 0 ? "📍 SUA CIDADE" : "🌍 COMPARAR"}
                  </span>
                  {i === 0 && <Btn small variant="ghost" onClick={detectLocation} style={{ fontSize: 9, padding: "1px 5px" }}>{locating ? "..." : "GPS"}</Btn>}
                </div>
                <select value={city.name} onChange={e => { const c = ALL_CITIES.find(x => x.name === e.target.value); if (c) setCity(i, c); }}
                  style={{ background: "transparent", border: "none", color: theme.text, fontSize: 15, fontWeight: 700, fontFamily: theme.fontSans, cursor: "pointer", outline: "none", padding: 0, marginTop: 2 }}>
                  {CITY_LIST.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <div style={{ fontSize: 32, fontWeight: 700, color: theme.text, fontFamily: theme.font, lineHeight: 1.1, marginTop: 2 }}>{getTime(city.tz)}</div>
                <div style={{ fontSize: 11, color: theme.textDim }}>{getDateStr(city.tz)}</div>
              </div>
              {w.temp && (
                <div style={{ textAlign: "right", paddingTop: 16 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: theme.amber, fontFamily: theme.font }}>{w.temp}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted }}>{w.condition}</div>
                  {w.humidity && <div style={{ fontSize: 10, color: theme.textDim }}>💧 {w.humidity}</div>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
        <Btn small variant="default" onClick={fetchWeather} disabled={loadingWeather} style={{ fontSize: 11, padding: "10px 12px", writingMode: "vertical-rl" }}>
          {loadingWeather ? "⏳" : "☀ Clima"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Dashboard ───
function Dashboard({ tasks, events, goTo, currentDate, onSelectEvent, goals, gaita, habits, health, films, books, fishing, aquarium, cities, setCities }) {
  const today = new Date();
  const todayStr = fmtDate(today);
  const todayTasks = tasks.filter(t => t.date === todayStr);
  const done = todayTasks.filter(t => t.done).length;
  const pending = todayTasks.filter(t => !t.done).length;
  const year = today.getFullYear();
  const monthKey = `${year}-${pad(today.getMonth()+1)}`;
  const annualGoals = goals.filter(g => g.scope === "annual" && g.year === year);
  const monthlyGoals = goals.filter(g => g.scope === "monthly" && g.monthKey === monthKey);
  const allGoals = [...annualGoals, ...monthlyGoals];
  const avgProgress = allGoals.length > 0 ? Math.round(allGoals.reduce((s, g) => s + (g.progress || 0), 0) / allGoals.length) : 0;
  const thisMonthGaita = gaita.filter(g => g.date?.startsWith(monthKey));
  const gaitaMin = thisMonthGaita.reduce((s, g) => s + (g.duration || 0), 0);
  const todayHealth = health.find(h => h.date === todayStr) || {};

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: theme.text, fontFamily: theme.fontSans }}>
          {today.getHours() < 12 ? "Bom dia" : today.getHours() < 18 ? "Boa tarde" : "Boa noite"}, Michel
        </h2>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 4 }}>
          {dayNames[today.getDay()]}, {today.getDate()} de {monthNames[today.getMonth()]} de {today.getFullYear()}
        </p>
      </div>

      {/* Weather & Clock */}
      <WeatherClock cities={cities} setCities={setCities} />

      {/* Top metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Tarefas hoje", value: todayTasks.length, color: "accent" },
          { label: "Concluídas", value: done, color: "green" },
          { label: "Pendentes", value: pending, color: "amber" },
          { label: "Eventos", value: events.length, color: "accent" },
          { label: "Metas progresso", value: `${avgProgress}%`, color: avgProgress >= 75 ? "green" : "amber" },
        ].map((m, i) => (
          <div key={i} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: theme.font }}>{m.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: theme[m.color] || theme.text, fontFamily: theme.font, marginTop: 2 }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Tasks */}
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Tarefas de hoje</h3>
            <Btn small onClick={() => goTo("tasks")} variant="ghost">Ver todas</Btn>
          </div>
          {todayTasks.length === 0 ? (
            <p style={{ color: theme.textDim, fontSize: 13, fontStyle: "italic" }}>Nenhuma tarefa para hoje</p>
          ) : todayTasks.slice(0, 5).map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < 4 ? `1px solid ${theme.border}` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.done ? theme.green : t.priority === "A" ? theme.red : t.priority === "B" ? theme.amber : theme.textDim }} />
              <span style={{ fontSize: 13, color: t.done ? theme.textDim : theme.text, textDecoration: t.done ? "line-through" : "none", flex: 1 }}>{t.text}</span>
              {t.priority && <Badge color={t.priority === "A" ? "red" : t.priority === "B" ? "amber" : "accent"}>{t.priority}</Badge>}
            </div>
          ))}
        </div>

        {/* Events */}
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Eventos do Calendar</h3>
            <Btn small onClick={() => goTo("daily")} variant="ghost">Dia completo</Btn>
          </div>
          {events.length === 0 ? (
            <p style={{ color: theme.textDim, fontSize: 13, fontStyle: "italic" }}>Clique "Sync Calendar" para ver eventos</p>
          ) : events.map((ev, i) => (
            <div key={i} onClick={() => onSelectEvent(ev)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < events.length - 1 ? `1px solid ${theme.border}` : "none", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 4, height: 28, borderRadius: 2, background: theme.accent, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: theme.text, fontWeight: 500 }}>{ev.title}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: theme.textMuted, fontFamily: theme.font }}>{ev.time || "Dia todo"}</span>
                  {ev.location && <span style={{ fontSize: 11, color: theme.textDim, display: "flex", alignItems: "center", gap: 3 }}>{Icons.mapPin} {ev.location}</span>}
                </div>
              </div>
              <span style={{ color: theme.textDim }}>{Icons.chevR}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Goals + Gaita + Health Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
        {/* Goals Summary */}
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Metas</h3>
            <Btn small onClick={() => goTo("annual")} variant="ghost">Ver todas</Btn>
          </div>
          {allGoals.length === 0 ? (
            <p style={{ color: theme.textDim, fontSize: 12, fontStyle: "italic" }}>Defina metas no Anual ou Mensal</p>
          ) : allGoals.slice(0, 4).map(g => (
            <div key={g.id} style={{ padding: "6px 0", borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: theme.text }}>{g.text}</span>
                <span style={{ color: g.progress >= 100 ? theme.green : theme.accent, fontFamily: theme.font, fontWeight: 600 }}>{g.progress}%</span>
              </div>
              <div style={{ height: 4, background: theme.bgHover, borderRadius: 2 }}>
                <div style={{ height: 4, background: g.progress >= 100 ? theme.green : theme.accent, borderRadius: 2, width: `${Math.min(g.progress, 100)}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Gaita Summary */}
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Gaita este mês</h3>
            <Btn small onClick={() => goTo("gaita")} variant="ghost">Detalhes</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: theme.bgHover, borderRadius: 6, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: theme.green, fontFamily: theme.font }}>{thisMonthGaita.length}</div>
              <div style={{ fontSize: 10, color: theme.textDim }}>sessões</div>
            </div>
            <div style={{ background: theme.bgHover, borderRadius: 6, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: theme.amber, fontFamily: theme.font }}>{Math.floor(gaitaMin/60)}h{gaitaMin%60}m</div>
              <div style={{ fontSize: 10, color: theme.textDim }}>praticadas</div>
            </div>
          </div>
          {thisMonthGaita.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>
              Última: {thisMonthGaita.sort((a,b) => b.date?.localeCompare(a.date))[0]?.song || "Prática"} — {thisMonthGaita[0]?.date}
            </div>
          )}
        </div>

        {/* Health Summary */}
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Saúde hoje</h3>
            <Btn small onClick={() => goTo("health")} variant="ghost">Detalhes</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <div style={{ background: theme.bgHover, borderRadius: 6, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.accent, fontFamily: theme.font }}>💧 {todayHealth.water || 0}</div>
              <div style={{ fontSize: 9, color: theme.textDim }}>copos</div>
            </div>
            <div style={{ background: theme.bgHover, borderRadius: 6, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.amber, fontFamily: theme.font }}>⚡ {todayHealth.energy || "-"}</div>
              <div style={{ fontSize: 9, color: theme.textDim }}>energia</div>
            </div>
            <div style={{ background: theme.bgHover, borderRadius: 6, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.green, fontFamily: theme.font }}>{todayHealth.sleep || "-"}</div>
              <div style={{ fontSize: 9, color: theme.textDim }}>sono</div>
            </div>
          </div>
        </div>
      </div>

      {/* Entertainment & Hobbies Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12 }} onClick={() => goTo("films")}>
          <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase", marginBottom: 4 }}>Filmes</div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: theme.amber, fontFamily: theme.font }}>{films.filter(f=>f.status==="watchlist").length} <span style={{ fontSize: 10, fontWeight: 400, color: theme.textDim }}>fila</span></span>
            <span style={{ fontSize: 16, fontWeight: 700, color: theme.green, fontFamily: theme.font }}>{films.filter(f=>f.status==="watched").length} <span style={{ fontSize: 10, fontWeight: 400, color: theme.textDim }}>vistos</span></span>
          </div>
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12 }} onClick={() => goTo("books")}>
          <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase", marginBottom: 4 }}>Livros</div>
          {books.filter(b=>b.status==="reading").slice(0,1).map(b => (
            <div key={b.id}><div style={{ fontSize: 12, color: theme.text, marginBottom: 3 }}>{b.title}</div>
            <div style={{ height: 4, background: theme.bgHover, borderRadius: 2 }}><div style={{ height: 4, background: theme.accent, borderRadius: 2, width: `${b.pages>0?Math.round(b.currentPage/b.pages*100):0}%` }} /></div></div>
          ))}
          {books.filter(b=>b.status==="reading").length===0 && <div style={{ fontSize: 11, color: theme.textDim }}>Nenhum em andamento</div>}
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12 }} onClick={() => goTo("fishing")}>
          <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase", marginBottom: 4 }}>Pescaria</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.green, fontFamily: theme.font }}>{fishing.length} saídas</div>
          {fishing[0] && <div style={{ fontSize: 10, color: theme.textMuted }}>Última: {fishing[0].location}</div>}
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12 }} onClick={() => goTo("aquarium")}>
          <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase", marginBottom: 4 }}>Aquário</div>
          {(()=>{ const lp=aquarium.filter(a=>a.type==="param").sort((a,b)=>b.date?.localeCompare(a.date))[0]; return lp ? <div style={{ fontSize: 12, color: theme.text }}>pH:{lp.ph} · {lp.temp}°C</div> : <div style={{ fontSize: 11, color: theme.textDim }}>Sem registros</div>; })()}
        </div>
      </div>
    </div>
  );
}
function DailyPlanner({ date, setDate, tasks, setTasks, events, setEvents, syncEvents, syncing, syncError }) {
  const [newTask, setNewTask] = useState("");
  const [newPri, setNewPri] = useState("B");
  const [showEventForm, setShowEventForm] = useState(false);
  const [showPasteEvents, setShowPasteEvents] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState("09:00");
  const [evEnd, setEvEnd] = useState("10:00");
  const [evDesc, setEvDesc] = useState("");
  const [evLocation, setEvLocation] = useState("");
  const [evReminder, setEvReminder] = useState("30");
  const [evRecurrence, setEvRecurrence] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const dateStr = fmtDate(date);
  const dayTasks = tasks.filter(t => t.date === dateStr);
  const hours = Array.from({ length: 11 }, (_, i) => i + 8);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: newTask, date: dateStr, priority: newPri, done: false }]);
    setNewTask("");
  };

  const toggleTask = id => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, done: !t.done } : t);
      const task = prev.find(t => t.id === id);
      if (task && !task.done && task.recurrence) {
        const nextDate = nextOccurrence(task.date, task.recurrence);
        if (nextDate) {
          updated.push({ id: Date.now(), text: task.text, date: nextDate, priority: task.priority, done: false, recurrence: task.recurrence });
        }
      }
      return updated;
    });
  };
  const removeTask = id => setTasks(prev => prev.filter(t => t.id !== id));

  const handleCreateEvent = async () => {
    if (!evTitle.trim()) return;
    setCreating(true);
    await createEvent(evTitle, dateStr, evStart, evEnd, evDesc, evLocation, evReminder, evRecurrence);
    setEvTitle(""); setEvDesc(""); setEvLocation(""); setEvRecurrence(""); setShowEventForm(false); setCreating(false);
    syncEvents(dateStr);
  };

  const handleDeleteEvent = () => {
    setSelectedEvent(null);
    syncEvents(dateStr);
  };

  const handlePasteEvents = () => {
    try {
      const json = JSON.parse(pasteText);
      const evts = json.events || json.items || (Array.isArray(json) ? json : []);
      const parsed = evts.map(ev => ({
        id: ev.id || "", title: ev.summary || ev.title || "Sem título",
        time: ev.start?.dateTime ? ev.start.dateTime.split("T")[1]?.slice(0,5) + " - " + (ev.end?.dateTime?.split("T")[1]?.slice(0,5) || "") : "Dia todo",
        hour: ev.start?.dateTime ? parseInt(ev.start.dateTime.split("T")[1]?.slice(0,2)) : 8,
        location: ev.location || "", status: ev.status || "confirmed",
        description: ev.description || "", htmlLink: ev.htmlLink || "",
        organizer: ev.organizer?.email || "", attendees: [], reminders: "", recurrence: ev.recurringEventId ? "Recorrente" : "",
      }));
      if (parsed.length > 0) { setEvents(parsed); setShowPasteEvents(false); setPasteText(""); }
    } catch { /* invalid JSON */ }
  };

  const requestSync = () => {
    sendPrompt(`Sincronizar eventos do Google Calendar para ${dateStr}. Retorne o JSON dos eventos.`);
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn small onClick={() => setDate(addDays(date, -1))} variant="ghost">{Icons.chevL}</Btn>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, fontFamily: theme.fontSans }}>
              {dayNames[date.getDay()]}, {date.getDate()} de {monthNames[date.getMonth()]}
            </h2>
            <p style={{ fontSize: 12, color: theme.textMuted, fontFamily: theme.font }}>{dateStr}</p>
          </div>
          <Btn small onClick={() => setDate(addDays(date, 1))} variant="ghost">{Icons.chevR}</Btn>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small onClick={() => setDate(new Date())} variant="ghost">Hoje</Btn>
          <Btn small onClick={() => syncEvents(dateStr)} variant="default" disabled={syncing}>
            <span className={syncing ? "loading" : ""}>{Icons.sync}</span> {syncing ? "..." : "Sync"}
          </Btn>
          <Btn small onClick={requestSync} variant="ghost" title="Pedir sync via chat">Chat</Btn>
          <Btn small onClick={() => setShowPasteEvents(!showPasteEvents)} variant="ghost" title="Colar eventos manualmente">Colar</Btn>
        </div>
      </div>

      {/* Sync error */}
      {syncError && <div style={{ background: theme.amberBg, border: `1px solid ${theme.amber}`, borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: theme.amber, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{syncError} — Use "Chat" pra pedir sync ou "Colar" pra colar JSON</span>
      </div>}

      {/* Paste events modal */}
      {showPasteEvents && (
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 8, fontFamily: theme.font }}>Colar eventos do Calendar</div>
          <p style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>Peça os eventos no chat digitando "Sync meus eventos de {dateStr}" e cole o JSON aqui:</p>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder='Cole o JSON dos eventos aqui...' rows={4} style={{ width: "100%", background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 10, fontSize: 11, fontFamily: theme.font, resize: "vertical", outline: "none", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small onClick={handlePasteEvents} variant="primary">Carregar eventos</Btn>
            <Btn small onClick={() => setShowPasteEvents(false)} variant="ghost">Cancelar</Btn>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Timeline */}
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, textTransform: "uppercase", letterSpacing: 1, fontFamily: theme.font }}>Agenda</h3>
            <Btn small onClick={() => setShowEventForm(!showEventForm)} variant="primary">{Icons.plus} Evento</Btn>
          </div>

          {/* Enhanced Create Event Form */}
          {showEventForm && (
            <div style={{ background: theme.bgInput, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 12, fontFamily: theme.font }}>Novo evento no Google Calendar</div>

              <Input value={evTitle} onChange={setEvTitle} placeholder="Título do evento" style={{ marginBottom: 8 }} />

              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: theme.textDim, display: "block", marginBottom: 3 }}>Início</label>
                  <Input type="time" value={evStart} onChange={setEvStart} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: theme.textDim, display: "block", marginBottom: 3 }}>Fim</label>
                  <Input type="time" value={evEnd} onChange={setEvEnd} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: theme.textDim, display: "block", marginBottom: 3 }}>Lembrete</label>
                  <select value={evReminder} onChange={e => setEvReminder(e.target.value)} style={{ width: "100%", background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "8px", fontSize: 13 }}>
                    <option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option>
                    <option value="30">30 min</option><option value="60">1 hora</option><option value="1440">1 dia</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: theme.textDim, display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                  {Icons.sync} Recorrência
                </label>
                <select value={evRecurrence} onChange={e => setEvRecurrence(e.target.value)} style={{ width: "100%", background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
                  {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ color: theme.textMuted }}>{Icons.mapPin}</span>
                <Input value={evLocation} onChange={setEvLocation} placeholder="Local (endereço, link de reunião...)" />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: theme.textDim, display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                  {Icons.text} Observações / Descrição
                </label>
                <textarea value={evDesc} onChange={e => setEvDesc(e.target.value)} placeholder="Pauta, links, anotações..." rows={3} style={{ width: "100%", background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 10, fontSize: 13, resize: "vertical", fontFamily: theme.fontSans, outline: "none" }} />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={handleCreateEvent} variant="primary" disabled={creating}>
                  {creating ? "Criando..." : "Criar no Google Calendar"}
                </Btn>
                <Btn onClick={() => setShowEventForm(false)} variant="ghost">Cancelar</Btn>
              </div>
            </div>
          )}

          {/* Time slots with clickable events */}
          {hours.map(h => {
            const timeEvents = events.filter(ev => ev.hour === h);
            return (
              <div key={h} style={{ display: "flex", minHeight: 44, borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ width: 50, paddingTop: 6, fontSize: 12, color: theme.textDim, fontFamily: theme.font, fontWeight: 500, flexShrink: 0 }}>
                  {pad(h)}:00
                </div>
                <div style={{ flex: 1, padding: "4px 0", display: "flex", flexDirection: "column", gap: 3 }}>
                  {timeEvents.map((ev, i) => (
                    <div key={i} onClick={() => setSelectedEvent(ev)} style={{ background: theme.accentBg, borderLeft: `3px solid ${theme.accent}`, borderRadius: "0 6px 6px 0", padding: "6px 12px", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
                      onMouseLeave={e => e.currentTarget.style.background = theme.accentBg}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, color: theme.accent, flex: 1 }}>{ev.title}</span>
                        <span style={{ color: theme.textDim, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>{Icons.chevR}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
                        {ev.time && <span style={{ color: theme.textMuted, fontFamily: theme.font, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>{Icons.clock} {ev.time}</span>}
                        {ev.location && <span style={{ color: theme.textDim, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>{Icons.mapPin} {ev.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Tasks + Focus */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, textTransform: "uppercase", letterSpacing: 1, fontFamily: theme.font, marginBottom: 12 }}>Tarefas do dia</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <Input value={newTask} onChange={setNewTask} placeholder="Nova tarefa..." onKeyDown={e => e.key === "Enter" && addTask()} style={{ flex: 1 }} />
              <select value={newPri} onChange={e => setNewPri(e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 8px", fontSize: 12 }}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </select>
              <Btn small onClick={addTask} variant="primary">{Icons.plus}</Btn>
            </div>
            {dayTasks.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${theme.border}` }}>
                <div onClick={() => toggleTask(t.id)} style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${t.done ? theme.green : theme.border}`, background: t.done ? theme.greenBg : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {t.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: t.done ? theme.textDim : theme.text, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                {t.recurrence && <span style={{ color: theme.accent, display: "flex" }} title={recurrenceLabel(t.recurrence)}>{Icons.sync}</span>}
                <Badge color={t.priority === "A" ? "red" : t.priority === "B" ? "amber" : "accent"}>{t.priority}</Badge>
                <span onClick={() => removeTask(t.id)} style={{ cursor: "pointer", color: theme.textDim, display: "flex" }}>{Icons.trash}</span>
              </div>
            ))}
            {dayTasks.length === 0 && <p style={{ color: theme.textDim, fontSize: 12, fontStyle: "italic", padding: "8px 0" }}>Nenhuma tarefa</p>}
          </div>

          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "14px 16px", flex: 1 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, textTransform: "uppercase", letterSpacing: 1, fontFamily: theme.font, marginBottom: 12 }}>Foco do dia</h3>
            <textarea placeholder="O que é mais importante hoje?" style={{ width: "100%", height: 80, background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 10, fontSize: 13, resize: "none", fontFamily: theme.fontSans, outline: "none" }} />
          </div>
        </div>
      </div>

      {/* Event Detail Side Panel */}
      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} onDelete={handleDeleteEvent} dateStr={dateStr} />
      )}
    </div>
  );
}

// ─── Weekly Planner ───
function WeeklyPlanner({ date, setDate, tasks, events }) {
  const weekDays = getWeekDays(date);
  const todayStr = fmtDate(new Date());

  return (
    <div className="fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn small onClick={() => setDate(addDays(date, -7))} variant="ghost">{Icons.chevL}</Btn>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, fontFamily: theme.fontSans }}>
            Semana {fmtDateBR(weekDays[0])} — {fmtDateBR(weekDays[6])}
          </h2>
          <Btn small onClick={() => setDate(addDays(date, 7))} variant="ghost">{Icons.chevR}</Btn>
        </div>
        <Btn small onClick={() => setDate(new Date())} variant="ghost">Hoje</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {weekDays.map((d, i) => {
          const ds = fmtDate(d);
          const isToday = ds === todayStr;
          const dayT = tasks.filter(t => t.date === ds);
          const done = dayT.filter(t => t.done).length;
          return (
            <div key={i} onClick={() => setDate(d)} style={{ background: isToday ? theme.accentBg : theme.bgCard, border: `1px solid ${isToday ? theme.accent : theme.border}`, borderRadius: 10, padding: 12, cursor: "pointer", minHeight: 200, transition: "all 0.15s" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? theme.accent : theme.textMuted, textTransform: "uppercase", fontFamily: theme.font, letterSpacing: 1 }}>{dayNamesShort[d.getDay()]}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: isToday ? theme.accent : theme.text, fontFamily: theme.font }}>{d.getDate()}</div>
              {dayT.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>
                  <Badge color={done === dayT.length ? "green" : "amber"}>{done}/{dayT.length}</Badge>
                </div>
              )}
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                {dayT.slice(0, 4).map((t, j) => (
                  <div key={j} style={{ fontSize: 11, color: t.done ? theme.textDim : theme.text, padding: "3px 6px", background: t.done ? "transparent" : theme.bgHover, borderRadius: 3, textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</div>
                ))}
                {dayT.length > 4 && <span style={{ fontSize: 10, color: theme.textDim }}>+{dayT.length - 4} mais</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tasks (Checklist) ───
function TasksView({ tasks, setTasks }) {
  const [newTask, setNewTask] = useState("");
  const [newPri, setNewPri] = useState("B");
  const [newDate, setNewDate] = useState(fmtDate(new Date()));
  const [newRecurrence, setNewRecurrence] = useState("");
  const [filter, setFilter] = useState("all");

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: newTask, date: newDate, priority: newPri, done: false, recurrence: newRecurrence }]);
    setNewTask(""); setNewRecurrence("");
  };

  const toggleTask = id => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, done: !t.done } : t);
      // If completing a recurring task, create next occurrence
      const task = prev.find(t => t.id === id);
      if (task && !task.done && task.recurrence) {
        const nextDate = nextOccurrence(task.date, task.recurrence);
        if (nextDate) {
          updated.push({ id: Date.now(), text: task.text, date: nextDate, priority: task.priority, done: false, recurrence: task.recurrence });
        }
      }
      return updated;
    });
  };

  const removeTask = id => setTasks(prev => prev.filter(t => t.id !== id));

  const filtered = tasks.filter(t => {
    if (filter === "done") return t.done;
    if (filter === "pending") return !t.done;
    if (filter === "recurring") return !!t.recurrence && !t.done;
    if (filter === "A" || filter === "B" || filter === "C") return t.priority === filter && !t.done;
    return true;
  }).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const priOrder = { A: 0, B: 1, C: 2 };
    return (priOrder[a.priority] || 1) - (priOrder[b.priority] || 1);
  });

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, fontFamily: theme.fontSans, marginBottom: 16 }}>Tarefas</h2>

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <Input value={newTask} onChange={setNewTask} placeholder="Nova tarefa..." onKeyDown={e => e.key === "Enter" && addTask()} style={{ flex: 1 }} />
          <Input type="date" value={newDate} onChange={setNewDate} style={{ width: 145 }} />
          <select value={newPri} onChange={e => setNewPri(e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 8px", fontSize: 13 }}>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
          <Btn onClick={addTask} variant="primary">{Icons.plus} Adicionar</Btn>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: theme.textDim, display: "flex", alignItems: "center", gap: 4 }}>{Icons.sync} Repetir:</span>
          <select value={newRecurrence} onChange={e => setNewRecurrence(e.target.value)} style={{ flex: 1, background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
            {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[["all","Todas"],["pending","Pendentes"],["done","Concluídas"],["recurring","Recorrentes"],["A","Prior. A"],["B","Prior. B"]].map(([v, l]) => (
          <Btn key={v} small onClick={() => setFilter(v)} variant={filter === v ? "primary" : "default"}>{l}</Btn>
        ))}
      </div>

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "6px 18px" }}>
        {filtered.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
            <div onClick={() => toggleTask(t.id)} style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${t.done ? theme.green : theme.border}`, background: t.done ? theme.greenBg : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {t.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <span style={{ flex: 1, fontSize: 14, color: t.done ? theme.textDim : theme.text, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            {t.recurrence && <Badge color="accent">{Icons.sync} {recurrenceLabel(t.recurrence)}</Badge>}
            <span style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font }}>{t.date}</span>
            <Badge color={t.priority === "A" ? "red" : t.priority === "B" ? "amber" : "accent"}>{t.priority}</Badge>
            <span onClick={() => removeTask(t.id)} style={{ cursor: "pointer", color: theme.textDim, display: "flex" }}>{Icons.trash}</span>
          </div>
        ))}
        {filtered.length === 0 && <p style={{ color: theme.textDim, fontSize: 13, padding: "20px 0", textAlign: "center" }}>Nenhuma tarefa encontrada</p>}
      </div>
    </div>
  );
}

// ─── Notes ───
function NotesView({ notes, setNotes }) {
  const [newTitle, setNewTitle] = useState("");

  const addNote = () => {
    if (!newTitle.trim()) return;
    setNotes(prev => [...prev, { id: Date.now(), title: newTitle, content: "", date: fmtDate(new Date()), color: ["accent","green","amber","red"][Math.floor(Math.random()*4)] }]);
    setNewTitle("");
  };

  const updateNote = (id, field, val) => setNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: val } : n));
  const removeNote = id => setNotes(prev => prev.filter(n => n.id !== id));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, fontFamily: theme.fontSans, marginBottom: 16 }}>Notas</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input value={newTitle} onChange={setNewTitle} placeholder="Título da nota..." onKeyDown={e => e.key === "Enter" && addNote()} style={{ flex: 1 }} />
        <Btn onClick={addNote} variant="primary">{Icons.plus} Nova nota</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {notes.map(n => (
          <div key={n.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, borderTop: `3px solid ${theme[n.color] || theme.accent}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
              <input value={n.title} onChange={e => updateNote(n.id, "title", e.target.value)} style={{ background: "transparent", border: "none", color: theme.text, fontSize: 15, fontWeight: 600, fontFamily: theme.fontSans, outline: "none", width: "100%" }} />
              <span onClick={() => removeNote(n.id)} style={{ cursor: "pointer", color: theme.textDim, flexShrink: 0, marginLeft: 8 }}>{Icons.trash}</span>
            </div>
            <textarea value={n.content} onChange={e => updateNote(n.id, "content", e.target.value)} placeholder="Escreva aqui..." rows={5} style={{ width: "100%", background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 10, fontSize: 13, resize: "vertical", fontFamily: theme.fontSans, outline: "none" }} />
            <div style={{ fontSize: 11, color: theme.textDim, marginTop: 8, fontFamily: theme.font }}>{n.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Annual Planner ───
function AnnualPlanner({ date, setDate, goals, setGoals, tasks }) {
  const year = date.getFullYear();
  const months_br = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const dow = ["S","T","Q","Q","S","S","D"];
  const todayStr = fmtDate(new Date());
  const annualGoals = goals.filter(g => g.scope === "annual" && g.year === year);

  const [goalInput, setGoalInput] = useState("");
  const [showGoalInput, setShowGoalInput] = useState(false);
  const addGoal = () => { if (!goalInput.trim()) return; setGoals(p => [...p, { id: Date.now(), text: goalInput, scope: "annual", year, progress: 0, quarter: "" }]); setGoalInput(""); setShowGoalInput(false); };
  const updGoal = (id, f, v) => setGoals(p => p.map(g => g.id === id ? { ...g, [f]: v } : g));
  const delGoal = id => setGoals(p => p.filter(g => g.id !== id));

  return (
    <div className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Btn small onClick={() => setDate(new Date(year - 1, 0, 1))} variant="ghost">{Icons.chevL}</Btn>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text }}>{year}</h2>
        <Btn small onClick={() => setDate(new Date(year + 1, 0, 1))} variant="ghost">{Icons.chevR}</Btn>
      </div>

      {/* 12 mini calendars */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
        {Array.from({ length: 12 }, (_, m) => {
          const cal = [];
          const fd = new Date(year, m, 1);
          const sd = (fd.getDay() + 6) % 7;
          const dim = new Date(year, m + 1, 0).getDate();
          for (let i = 0; i < sd; i++) cal.push(0);
          for (let d = 1; d <= dim; d++) cal.push(d);
          const monthTasks = tasks.filter(t => t.date?.startsWith(`${year}-${pad(m+1)}`));
          return (
            <div key={m} onClick={() => { setDate(new Date(year, m, 1)); }} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 8, cursor: "pointer" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textAlign: "center", marginBottom: 4, fontFamily: theme.font }}>{months_br[m]}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
                {dow.map((d, i) => <div key={i} style={{ fontSize: 7, textAlign: "center", color: theme.textDim, fontFamily: theme.font }}>{d}</div>)}
                {cal.map((d, i) => {
                  const ds = d ? `${year}-${pad(m+1)}-${pad(d)}` : "";
                  const isToday = ds === todayStr;
                  return <div key={i} style={{ fontSize: 8, textAlign: "center", color: isToday ? theme.accent : d ? theme.text : "transparent", fontWeight: isToday ? 700 : 400, background: isToday ? theme.accentBg : "transparent", borderRadius: 2, fontFamily: theme.font }}>{d || "."}</div>;
                })}
              </div>
              {monthTasks.length > 0 && <div style={{ textAlign: "center", marginTop: 3 }}><Badge color="amber">{monthTasks.length} tarefas</Badge></div>}
            </div>
          );
        })}
      </div>

      {/* Annual Goals */}
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Metas Anuais {year}</h3>
          <Btn small onClick={() => setShowGoalInput(!showGoalInput)} variant="primary">{Icons.plus} Meta</Btn>
        </div>
        {showGoalInput && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <Input value={goalInput} onChange={setGoalInput} placeholder="Descreva a meta anual..." onKeyDown={e => { if (e.key === "Enter") addGoal(); if (e.key === "Escape") setShowGoalInput(false); }} autoFocus style={{ flex: 1 }} />
            <Btn small variant="primary" onClick={addGoal}>OK</Btn>
            <Btn small variant="ghost" onClick={() => setShowGoalInput(false)}>{Icons.x}</Btn>
          </div>
        )}
        {annualGoals.map(g => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
            <span style={{ flex: 1, fontSize: 14, color: theme.text }}>{g.text}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 180 }}>
              <input type="range" min="0" max="100" value={g.progress} onChange={e => updGoal(g.id, "progress", parseInt(e.target.value))} style={{ flex: 1, accentColor: theme.accent }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: g.progress >= 100 ? theme.green : theme.accent, fontFamily: theme.font, minWidth: 35 }}>{g.progress}%</span>
            </div>
            <span onClick={() => delGoal(g.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
          </div>
        ))}
        {annualGoals.length === 0 && <p style={{ color: theme.textDim, fontSize: 13, fontStyle: "italic" }}>Nenhuma meta definida</p>}
      </div>
    </div>
  );
}

// ─── Monthly Planner (with goals) ───
function MonthlyPlanner({ date, setDate, tasks, goals, setGoals }) {
  const year = date.getFullYear(), month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = fmtDate(new Date());
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthKey = `${year}-${pad(month+1)}`;
  const monthGoals = goals.filter(g => g.scope === "monthly" && g.monthKey === monthKey);
  const [goalInput, setGoalInput] = useState("");
  const [showGoalInput, setShowGoalInput] = useState(false);
  const addGoal = () => { if (!goalInput.trim()) return; setGoals(p => [...p, { id: Date.now(), text: goalInput, scope: "monthly", monthKey, progress: 0 }]); setGoalInput(""); setShowGoalInput(false); };
  const updGoal = (id, f, v) => setGoals(p => p.map(g => g.id === id ? { ...g, [f]: v } : g));
  const delGoal = id => setGoals(p => p.filter(g => g.id !== id));

  return (
    <div className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Btn small onClick={() => setDate(new Date(year, month - 1, 1))} variant="ghost">{Icons.chevL}</Btn>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>{monthNames[month]} {year}</h2>
        <Btn small onClick={() => setDate(new Date(year, month + 1, 1))} variant="ghost">{Icons.chevR}</Btn>
        <Btn small onClick={() => setDate(new Date())} variant="ghost" style={{ marginLeft: 8 }}>Hoje</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
        {/* Calendar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {dayNamesShort.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: theme.textMuted, padding: 6, fontFamily: theme.font }}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const ds = `${year}-${pad(month+1)}-${pad(d)}`;
            const isToday = ds === todayStr;
            const dt = tasks.filter(t => t.date === ds);
            const done = dt.filter(t => t.done).length;
            return (
              <div key={i} onClick={() => setDate(new Date(year, month, d))} style={{ background: isToday ? theme.accentBg : theme.bgCard, border: `1px solid ${isToday ? theme.accent : theme.border}`, borderRadius: 6, padding: 6, minHeight: 65, cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: isToday ? theme.accent : theme.text, fontFamily: theme.font }}>{d}</div>
                {dt.length > 0 && <div style={{ marginTop: 3 }}><Badge color={done === dt.length ? "green" : "amber"}>{done}/{dt.length}</Badge></div>}
                {dt.filter(t => !t.done).slice(0, 2).map((t, j) => <div key={j} style={{ fontSize: 9, color: theme.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</div>)}
              </div>
            );
          })}
        </div>

        {/* Monthly Goals sidebar */}
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, fontFamily: theme.font }}>METAS DO MÊS</h3>
            <Btn small onClick={() => setShowGoalInput(!showGoalInput)} variant="primary">{Icons.plus}</Btn>
          </div>
          {showGoalInput && (
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              <Input value={goalInput} onChange={setGoalInput} placeholder="Meta do mês..." onKeyDown={e => { if (e.key === "Enter") addGoal(); if (e.key === "Escape") setShowGoalInput(false); }} autoFocus style={{ flex: 1 }} />
              <Btn small variant="primary" onClick={addGoal}>OK</Btn>
            </div>
          )}
          {monthGoals.map(g => (
            <div key={g.id} style={{ padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: theme.text, flex: 1 }}>{g.text}</span>
                <span onClick={() => delGoal(g.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <input type="range" min="0" max="100" value={g.progress} onChange={e => updGoal(g.id, "progress", parseInt(e.target.value))} style={{ flex: 1, accentColor: theme.accent }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: g.progress >= 100 ? theme.green : theme.accent, fontFamily: theme.font }}>{g.progress}%</span>
              </div>
            </div>
          ))}
          {monthGoals.length === 0 && <p style={{ color: theme.textDim, fontSize: 11, fontStyle: "italic" }}>Clique + para definir metas</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Gaita (Harmonica) Tracker ───
function GaitaView({ gaita, setGaita }) {
  const [form, setForm] = useState({ date: fmtDate(new Date()), duration: "30", type: "pratica", song: "", notes: "", rating: 3 });
  const types = { pratica: "Prática", aula: "Aula", teoria: "Teoria", repertorio: "Repertório" };

  const add = () => { setGaita(p => [...p, { ...form, id: Date.now(), duration: parseInt(form.duration) || 0 }]); setForm({ ...form, song: "", notes: "" }); };
  const del = id => setGaita(p => p.filter(x => x.id !== id));

  const totalMin = gaita.reduce((s, g) => s + (g.duration || 0), 0);
  const totalSessions = gaita.length;
  const thisMonth = gaita.filter(g => g.date?.startsWith(fmtDate(new Date()).slice(0, 7)));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 16 }}>Aulas de Gaita</h2>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { l: "Total sessões", v: totalSessions, c: theme.accent },
          { l: "Horas praticadas", v: `${Math.floor(totalMin / 60)}h${totalMin % 60}m`, c: theme.green },
          { l: "Este mês", v: thisMonth.length, c: theme.amber },
          { l: "Média/sessão", v: totalSessions ? `${Math.round(totalMin / totalSessions)}min` : "0", c: theme.text },
        ].map((m, i) => (
          <div key={i} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.c, fontFamily: theme.font, marginTop: 2 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Add session */}
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 10, fontFamily: theme.font }}>Registrar sessão</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <Input type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} style={{ width: 140 }} />
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 10px", fontSize: 12 }}>
            {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input value={form.duration} onChange={v => setForm({ ...form, duration: v })} placeholder="Minutos" type="number" style={{ width: 80 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {[1,2,3,4,5].map(n => (
              <span key={n} onClick={() => setForm({ ...form, rating: n })} style={{ cursor: "pointer", fontSize: 16, color: n <= form.rating ? theme.amber : theme.textDim }}>★</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <Input value={form.song} onChange={v => setForm({ ...form, song: v })} placeholder="Música / Exercício praticado" style={{ flex: 1 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Observações (dificuldades, progressos...)" style={{ flex: 1 }} />
          <Btn onClick={add} variant="primary">{Icons.plus} Registrar</Btn>
        </div>
      </div>

      {/* History */}
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "4px 14px" }}>
        {gaita.sort((a, b) => b.date?.localeCompare(a.date)).map(g => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ width: 4, height: 36, borderRadius: 2, background: g.type === "aula" ? theme.accent : g.type === "pratica" ? theme.green : g.type === "teoria" ? theme.amber : theme.red, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>{g.song || types[g.type]}</span>
                <Badge>{types[g.type]}</Badge>
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, display: "flex", gap: 8 }}>
                <span>{g.date}</span>
                <span>{g.duration}min</span>
                <span style={{ color: theme.amber }}>{"★".repeat(g.rating || 0)}</span>
              </div>
              {g.notes && <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2, fontStyle: "italic" }}>{g.notes}</div>}
            </div>
            <span onClick={() => del(g.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
          </div>
        ))}
        {gaita.length === 0 && <p style={{ color: theme.textDim, fontSize: 13, padding: 16, textAlign: "center" }}>Nenhuma sessão registrada</p>}
      </div>
    </div>
  );
}

// ─── Projects (Comprehensive) ───
const PROJ_TYPES = [
  { id: "software", label: "Software", icon: "\u{1F4BB}" },
  { id: "importacao", label: "Importação", icon: "\u{1F6A2}" },
  { id: "comercial", label: "Comercial", icon: "\u{1F4CA}" },
  { id: "operacional", label: "Operacional", icon: "\u2699" },
  { id: "bi", label: "BI/Analytics", icon: "\u{1F4C8}" },
  { id: "produto", label: "Produto/BOM", icon: "\u{1F4E6}" },
  { id: "consultoria", label: "Consultoria", icon: "\u{1F4BC}" },
  { id: "pessoal", label: "Pessoal", icon: "\u{1F3AF}" },
];
const PROJ_STATUS = { idea:{label:"Ideia",c:"textMuted"}, planning:{label:"Planejando",c:"accent"}, active:{label:"Em andamento",c:"amber"}, review:{label:"Em revisão",c:"accent"}, done:{label:"Concluído",c:"green"}, blocked:{label:"Bloqueado",c:"red"}, paused:{label:"Pausado",c:"textDim"} };
const PROJ_PRIORITY = { alta:{label:"Alta",c:"red"}, media:{label:"Média",c:"amber"}, baixa:{label:"Baixa",c:"accent"} };

function ProjectsView({ projects, setProjects }) {
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ name:"", type:"software", priority:"media", objective:"", resp:"", deadline:"" });
  const emptyForm = () => ({ name:"", type:"software", priority:"media", objective:"", resp:"", deadline:"" });

  // Inline input states (replace prompt() which doesn't work in artifacts)
  const [inlineInput, setInlineInput] = useState({ type: null, pid: null, phId: null, value: "" });
  const showInline = (type, pid, phId) => setInlineInput({ type, pid, phId: phId || null, value: "" });
  const cancelInline = () => setInlineInput({ type: null, pid: null, phId: null, value: "" });
  const confirmInline = () => {
    const { type, pid, phId, value } = inlineInput;
    if (!value.trim()) { cancelInline(); return; }
    if (type === "phase") setProjects(p => p.map(x => x.id === pid ? { ...x, phases: [...(x.phases||[]), { id: Date.now(), name: value, deadline: "", status: "planning", deliverables: [] }] } : x));
    if (type === "deliverable") setProjects(p => p.map(x => x.id === pid ? { ...x, phases: (x.phases||[]).map(ph => ph.id === phId ? { ...ph, deliverables: [...(ph.deliverables||[]), { text: value, done: false }] } : ph) } : x));
    if (type === "task") setProjects(p => p.map(x => x.id === pid ? { ...x, tasks: [...(x.tasks||[]), { id: Date.now(), text: value, done: false }] } : x));
    if (type === "risk") setProjects(p => p.map(x => x.id === pid ? { ...x, risks: [...(x.risks||[]), { id: Date.now(), text: value, resolved: false }] } : x));
    if (type === "log") setProjects(p => p.map(x => x.id === pid ? { ...x, log: [...(x.log||[]), { date: fmtDate(new Date()), time: fmtTime(new Date()), text: value }] } : x));
    cancelInline();
  };

  const InlineAdd = ({ type, pid, phId, placeholder }) => {
    if (inlineInput.type !== type || inlineInput.pid !== pid || (phId && inlineInput.phId !== phId)) return null;
    return (
      <div style={{ display: "flex", gap: 6, marginTop: 4, marginBottom: 4 }}>
        <Input value={inlineInput.value} onChange={v => setInlineInput(prev => ({ ...prev, value: v }))} placeholder={placeholder} onKeyDown={e => { if (e.key === "Enter") confirmInline(); if (e.key === "Escape") cancelInline(); }} autoFocus style={{ flex: 1 }} />
        <Btn small variant="primary" onClick={confirmInline}>OK</Btn>
        <Btn small variant="ghost" onClick={cancelInline}>{Icons.x}</Btn>
      </div>
    );
  };

  const add = () => { if (!form.name.trim()) return; setProjects(p => [...p, { ...form, id:Date.now(), status:"planning", description:"", expectedOutcome:"", stakeholders:"", startDate:fmtDate(new Date()), budget:"", techStack:"", repoUrl:"", phases:[], tasks:[], risks:[], notes:"", log:[], createdAt:fmtDate(new Date()) }]); setForm(emptyForm()); setShowForm(false); };
  const upd = (id,f,v) => setProjects(p => p.map(x => x.id===id ? {...x,[f]:v} : x));
  const del = id => { setProjects(p => p.filter(x => x.id!==id)); setSelected(null); };

  const updPhase = (pid,phId,f,v) => setProjects(p=>p.map(x=>x.id===pid?{...x,phases:(x.phases||[]).map(ph=>ph.id===phId?{...ph,[f]:v}:ph)}:x));
  const delPhase = (pid,phId) => setProjects(p=>p.map(x=>x.id===pid?{...x,phases:(x.phases||[]).filter(ph=>ph.id!==phId)}:x));
  const togDel = (pid,phId,di) => setProjects(p=>p.map(x=>x.id===pid?{...x,phases:(x.phases||[]).map(ph=>ph.id===phId?{...ph,deliverables:(ph.deliverables||[]).map((d,i)=>i===di?{...d,done:!d.done}:d)}:ph)}:x));

  const togTask = (pid,tid) => setProjects(p=>p.map(x=>x.id===pid?{...x,tasks:(x.tasks||[]).map(t=>t.id===tid?{...t,done:!t.done}:t)}:x));
  const delTask = (pid,tid) => setProjects(p=>p.map(x=>x.id===pid?{...x,tasks:(x.tasks||[]).filter(t=>t.id!==tid)}:x));

  const togRisk = (pid,rid) => setProjects(p=>p.map(x=>x.id===pid?{...x,risks:(x.risks||[]).map(r=>r.id===rid?{...r,resolved:!r.resolved}:r)}:x));

  const getProgress = p => { const all=[...(p.tasks||[])]; (p.phases||[]).forEach(ph=>(ph.deliverables||[]).forEach(d=>all.push(d))); return all.length?Math.round(all.filter(t=>t.done).length/all.length*100):0; };

  const filtered = projects.filter(p => { if(filter==="all") return true; if(filter==="active") return ["active","planning","review"].includes(p.status); if(filter==="done") return p.status==="done"; if(filter==="blocked") return p.status==="blocked"; return p.type===filter; });
  const proj = selected ? projects.find(p=>p.id===selected) : null;

  // ─── DETAIL VIEW ───
  if (proj) {
    const typeInfo = PROJ_TYPES.find(t=>t.id===proj.type)||PROJ_TYPES[0];
    const progress = getProgress(proj);
    const totalT = (proj.tasks||[]).length + (proj.phases||[]).reduce((s,ph)=>s+(ph.deliverables||[]).length,0);
    const doneT = (proj.tasks||[]).filter(t=>t.done).length + (proj.phases||[]).reduce((s,ph)=>s+(ph.deliverables||[]).filter(d=>d.done).length,0);
    return (
      <div className="fade-in">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <Btn small variant="ghost" onClick={()=>setSelected(null)}>{Icons.chevL} Voltar</Btn>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:20}}>{typeInfo.icon}</span>
              <h2 style={{fontSize:18,fontWeight:700,color:theme.text}}>{proj.name}</h2>
            </div>
            <div style={{display:"flex",gap:6,marginTop:4}}>
              <Badge>{typeInfo.label}</Badge>
              <Badge color={PROJ_PRIORITY[proj.priority]?.c||"accent"}>{PROJ_PRIORITY[proj.priority]?.label}</Badge>
              <Badge color={PROJ_STATUS[proj.status]?.c||"accent"}>{PROJ_STATUS[proj.status]?.label}</Badge>
            </div>
          </div>
          <span onClick={()=>del(proj.id)} style={{cursor:"pointer",color:theme.textDim}}>{Icons.trash}</span>
        </div>

        {/* Progress bar */}
        <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginBottom:12,display:"flex",alignItems:"center",gap:14}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
              <span style={{color:theme.textMuted}}>Progresso</span>
              <span style={{color:progress>=100?theme.green:theme.accent,fontWeight:700,fontFamily:theme.font}}>{progress}% ({doneT}/{totalT})</span>
            </div>
            <div style={{height:8,background:theme.bgHover,borderRadius:4}}><div style={{height:8,background:progress>=100?theme.green:theme.accent,borderRadius:4,width:`${progress}%`,transition:"width 0.3s"}}/></div>
          </div>
          <select value={proj.status} onChange={e=>upd(proj.id,"status",e.target.value)} style={{background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:6,padding:"6px 10px",fontSize:12}}>
            {Object.entries(PROJ_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          {/* Context */}
          <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14}}>
            <h3 style={{fontSize:12,fontWeight:600,color:theme.textMuted,fontFamily:theme.font,marginBottom:8,textTransform:"uppercase"}}>Contexto</h3>
            <label style={{fontSize:10,color:theme.textDim}}>Objetivo</label>
            <textarea value={proj.objective||""} onChange={e=>upd(proj.id,"objective",e.target.value)} placeholder="O que pretende alcançar?" rows={2} style={{width:"100%",background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:4,padding:8,fontSize:12,resize:"vertical",fontFamily:theme.fontSans,outline:"none",marginBottom:6}}/>
            <label style={{fontSize:10,color:theme.textDim}}>Descrição / Escopo</label>
            <textarea value={proj.description||""} onChange={e=>upd(proj.id,"description",e.target.value)} placeholder="Detalhes, contexto, escopo..." rows={2} style={{width:"100%",background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:4,padding:8,fontSize:12,resize:"vertical",fontFamily:theme.fontSans,outline:"none",marginBottom:6}}/>
            <label style={{fontSize:10,color:theme.textDim}}>Resultado esperado</label>
            <textarea value={proj.expectedOutcome||""} onChange={e=>upd(proj.id,"expectedOutcome",e.target.value)} placeholder="Como saberemos que foi bem-sucedido?" rows={2} style={{width:"100%",background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:4,padding:8,fontSize:12,resize:"vertical",fontFamily:theme.fontSans,outline:"none"}}/>
          </div>
          {/* Details */}
          <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14}}>
            <h3 style={{fontSize:12,fontWeight:600,color:theme.textMuted,fontFamily:theme.font,marginBottom:8,textTransform:"uppercase"}}>Detalhes</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <div><label style={{fontSize:10,color:theme.textDim}}>Responsável</label><Input value={proj.resp||""} onChange={v=>upd(proj.id,"resp",v)} placeholder="Quem lidera"/></div>
              <div><label style={{fontSize:10,color:theme.textDim}}>Stakeholders</label><Input value={proj.stakeholders||""} onChange={v=>upd(proj.id,"stakeholders",v)} placeholder="Interessados"/></div>
              <div><label style={{fontSize:10,color:theme.textDim}}>Início</label><Input type="date" value={proj.startDate||""} onChange={v=>upd(proj.id,"startDate",v)}/></div>
              <div><label style={{fontSize:10,color:theme.textDim}}>Prazo</label><Input type="date" value={proj.deadline||""} onChange={v=>upd(proj.id,"deadline",v)}/></div>
              <div><label style={{fontSize:10,color:theme.textDim}}>Orçamento</label><Input value={proj.budget||""} onChange={v=>upd(proj.id,"budget",v)} placeholder="R$"/></div>
              <div><label style={{fontSize:10,color:theme.textDim}}>Prioridade</label><select value={proj.priority} onChange={e=>upd(proj.id,"priority",e.target.value)} style={{width:"100%",background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:6,padding:"8px",fontSize:12}}>{Object.entries(PROJ_PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
            </div>
            {(proj.type==="software"||proj.type==="bi") && <div style={{marginTop:8,borderTop:`1px solid ${theme.border}`,paddingTop:8}}>
              <label style={{fontSize:10,color:theme.textDim}}>Stack / Tecnologias</label>
              <Input value={proj.techStack||""} onChange={v=>upd(proj.id,"techStack",v)} placeholder="React, Node.js, PostgreSQL..." style={{marginBottom:4}}/>
              <label style={{fontSize:10,color:theme.textDim}}>Repositório / URL</label>
              <Input value={proj.repoUrl||""} onChange={v=>upd(proj.id,"repoUrl",v)} placeholder="https://github.com/..."/>
            </div>}
          </div>
        </div>

        {/* Phases */}
        <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h3 style={{fontSize:12,fontWeight:600,color:theme.textMuted,fontFamily:theme.font,textTransform:"uppercase"}}>Fases / Etapas</h3>
            <Btn small variant="primary" onClick={()=>showInline("phase",proj.id)}>{Icons.plus} Fase</Btn>
          </div>
          <InlineAdd type="phase" pid={proj.id} placeholder="Nome da fase/etapa..." />
          {(proj.phases||[]).length===0 && inlineInput.type !== "phase" && <p style={{fontSize:12,color:theme.textDim,fontStyle:"italic"}}>Adicione etapas para organizar o projeto</p>}
          {(proj.phases||[]).map((ph,pi) => (
            <div key={ph.id} style={{border:`1px solid ${theme.border}`,borderRadius:8,padding:12,marginBottom:8,background:theme.bg}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:600,color:theme.accent,fontFamily:theme.font}}>{pi+1}.</span>
                <span style={{fontSize:13,fontWeight:600,color:theme.text,flex:1}}>{ph.name}</span>
                <select value={ph.status} onChange={e=>updPhase(proj.id,ph.id,"status",e.target.value)} style={{background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:4,padding:"2px 6px",fontSize:10}}>
                  {Object.entries(PROJ_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
                <Input type="date" value={ph.deadline||""} onChange={v=>updPhase(proj.id,ph.id,"deadline",v)} style={{width:120,padding:"3px 6px",fontSize:10}}/>
                <span onClick={()=>delPhase(proj.id,ph.id)} style={{cursor:"pointer",color:theme.textDim}}>{Icons.trash}</span>
              </div>
              {(ph.deliverables||[]).map((d,di) => (
                <div key={di} onClick={()=>togDel(proj.id,ph.id,di)} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0 3px 20px",cursor:"pointer",fontSize:12}}>
                  <div style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${d.done?theme.green:theme.border}`,background:d.done?theme.greenBg:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {d.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={theme.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span style={{color:d.done?theme.textDim:theme.text,textDecoration:d.done?"line-through":"none"}}>{d.text}</span>
                </div>
              ))}
              <Btn small variant="ghost" onClick={()=>showInline("deliverable",proj.id,ph.id)} style={{marginTop:4,marginLeft:20,fontSize:10}}>{Icons.plus} Entrega</Btn>
              <div style={{marginLeft:20}}><InlineAdd type="deliverable" pid={proj.id} phId={ph.id} placeholder="Nome da entrega..." /></div>
            </div>
          ))}
        </div>

        {/* Tasks */}
        <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h3 style={{fontSize:12,fontWeight:600,color:theme.textMuted,fontFamily:theme.font,textTransform:"uppercase"}}>Tarefas gerais</h3>
            <Btn small variant="primary" onClick={()=>showInline("task",proj.id)}>{Icons.plus} Tarefa</Btn>
          </div>
          <InlineAdd type="task" pid={proj.id} placeholder="Descrição da tarefa..." />
          {(proj.tasks||[]).map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${theme.border}`}}>
              <div onClick={()=>togTask(proj.id,t.id)} style={{width:16,height:16,borderRadius:3,border:`1.5px solid ${t.done?theme.green:theme.border}`,background:t.done?theme.greenBg:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {t.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={theme.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{flex:1,fontSize:13,color:t.done?theme.textDim:theme.text,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
              <span onClick={()=>delTask(proj.id,t.id)} style={{cursor:"pointer",color:theme.textDim}}>{Icons.trash}</span>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {/* Risks */}
          <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <h3 style={{fontSize:12,fontWeight:600,color:theme.textMuted,fontFamily:theme.font,textTransform:"uppercase"}}>Riscos / Bloqueios</h3>
              <Btn small variant="ghost" onClick={()=>showInline("risk",proj.id)}>{Icons.plus}</Btn>
            </div>
            <InlineAdd type="risk" pid={proj.id} placeholder="Descreva o risco ou bloqueio..." />
            {(proj.risks||[]).map(r=>(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:`1px solid ${theme.border}`,fontSize:12}}>
                <div onClick={()=>togRisk(proj.id,r.id)} style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${r.resolved?theme.green:theme.red}`,background:r.resolved?theme.greenBg:theme.redBg,cursor:"pointer",flexShrink:0}}/>
                <span style={{color:r.resolved?theme.textDim:theme.text,textDecoration:r.resolved?"line-through":"none",flex:1}}>{r.text}</span>
              </div>
            ))}
          </div>
          {/* Log */}
          <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <h3 style={{fontSize:12,fontWeight:600,color:theme.textMuted,fontFamily:theme.font,textTransform:"uppercase"}}>Registro de atividades</h3>
              <Btn small variant="ghost" onClick={()=>showInline("log",proj.id)}>{Icons.plus}</Btn>
            </div>
            <InlineAdd type="log" pid={proj.id} placeholder="Registro, decisão, anotação..." />
            {(proj.log||[]).slice(-8).reverse().map((l,i)=>(
              <div key={i} style={{padding:"4px 0",borderBottom:`1px solid ${theme.border}`,fontSize:11}}>
                <span style={{color:theme.textDim,fontFamily:theme.font}}>{l.date} {l.time}</span>
                <span style={{color:theme.text,marginLeft:8}}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,marginTop:12}}>
          <h3 style={{fontSize:12,fontWeight:600,color:theme.textMuted,fontFamily:theme.font,marginBottom:8,textTransform:"uppercase"}}>Notas gerais</h3>
          <textarea value={proj.notes||""} onChange={e=>upd(proj.id,"notes",e.target.value)} placeholder="Decisões, referências, links..." rows={4} style={{width:"100%",background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:6,padding:10,fontSize:13,resize:"vertical",fontFamily:theme.fontSans,outline:"none"}}/>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h2 style={{fontSize:18,fontWeight:700,color:theme.text}}>Projetos</h2>
        <Btn onClick={()=>setShowForm(!showForm)} variant="primary">{Icons.plus} Novo projeto</Btn>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {[["all","Todos"],["active","Ativos"],["done","Concluídos"],["blocked","Bloqueados"]].map(([k,l])=>(
          <Btn key={k} small variant={filter===k?"primary":"default"} onClick={()=>setFilter(k)}>{l}</Btn>
        ))}
        <span style={{borderLeft:`1px solid ${theme.border}`,margin:"0 4px"}}/>
        {PROJ_TYPES.map(t=>(
          <Btn key={t.id} small variant={filter===t.id?"primary":"default"} onClick={()=>setFilter(filter===t.id?"all":t.id)} style={{fontSize:11}}>{t.icon}</Btn>
        ))}
      </div>
      {showForm && (
        <div style={{background:theme.bgCard,border:`1px solid ${theme.accent}`,borderRadius:10,padding:16,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:theme.accent,marginBottom:10,fontFamily:theme.font}}>Novo projeto</div>
          <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <Input value={form.name} onChange={v=>setForm({...form,name:v})} placeholder="Nome do projeto" style={{flex:2,minWidth:180}}/>
            <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:6,padding:"0 8px",fontSize:12}}>
              {PROJ_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} style={{background:theme.bgInput,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:6,padding:"0 8px",fontSize:12}}>
              {Object.entries(PROJ_PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <Input value={form.objective} onChange={v=>setForm({...form,objective:v})} placeholder="Objetivo principal" style={{flex:1}}/>
            <Input value={form.resp} onChange={v=>setForm({...form,resp:v})} placeholder="Responsável" style={{width:140}}/>
            <Input type="date" value={form.deadline} onChange={v=>setForm({...form,deadline:v})} style={{width:140}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={add} variant="primary">Criar projeto</Btn>
            <Btn onClick={()=>setShowForm(false)} variant="ghost">Cancelar</Btn>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {filtered.map(p=>{
          const typeInfo=PROJ_TYPES.find(t=>t.id===p.type)||PROJ_TYPES[0];
          const progress=getProgress(p);
          const totalT=(p.tasks||[]).length+(p.phases||[]).reduce((s,ph)=>s+(ph.deliverables||[]).length,0);
          const doneT=(p.tasks||[]).filter(t=>t.done).length+(p.phases||[]).reduce((s,ph)=>s+(ph.deliverables||[]).filter(d=>d.done).length,0);
          return (
            <div key={p.id} onClick={()=>setSelected(p.id)} style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:14,cursor:"pointer",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=theme.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=theme.border}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:16}}>{typeInfo.icon}</span>
                <span style={{fontWeight:600,fontSize:14,color:theme.text,flex:1}}>{p.name}</span>
                <Badge color={PROJ_STATUS[p.status]?.c||"accent"}>{PROJ_STATUS[p.status]?.label}</Badge>
              </div>
              {p.objective && <div style={{fontSize:12,color:theme.textMuted,marginBottom:6,lineHeight:1.4}}>{p.objective}</div>}
              <div style={{height:4,background:theme.bgHover,borderRadius:2,marginBottom:6}}>
                <div style={{height:4,background:progress>=100?theme.green:theme.accent,borderRadius:2,width:`${progress}%`}}/>
              </div>
              <div style={{display:"flex",gap:6,fontSize:11,color:theme.textDim,flexWrap:"wrap"}}>
                <Badge color={PROJ_PRIORITY[p.priority]?.c||"accent"}>{PROJ_PRIORITY[p.priority]?.label}</Badge>
                {p.resp && <span>{p.resp}</span>}
                {p.deadline && <span>{p.deadline}</span>}
                {totalT>0 && <span>{doneT}/{totalT} tarefas</span>}
                {(p.phases||[]).length>0 && <span>{(p.phases||[]).length} fases</span>}
                {(p.risks||[]).filter(r=>!r.resolved).length>0 && <Badge color="red">{(p.risks||[]).filter(r=>!r.resolved).length} riscos</Badge>}
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length===0 && <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:10,padding:24,textAlign:"center",color:theme.textDim}}>Nenhum projeto</div>}
    </div>
  );
}

// ─── Kanban ───
function KanbanView({ kanban, setKanban }) {
  const columns = ["backlog", "doing", "review", "done"];
  const labels = { backlog: "Backlog", doing: "Em andamento", review: "Review", done: "Concluído" };
  const [newCard, setNewCard] = useState("");
  const [newCol, setNewCol] = useState("backlog");

  const add = () => { if (!newCard.trim()) return; setKanban(p => [...p, { id: Date.now(), text: newCard, col: newCol }]); setNewCard(""); };
  const move = (id, col) => setKanban(p => p.map(c => c.id === id ? { ...c, col } : c));
  const del = id => setKanban(p => p.filter(c => c.id !== id));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 12 }}>Kanban</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input value={newCard} onChange={setNewCard} placeholder="Novo card..." onKeyDown={e => e.key === "Enter" && add()} style={{ flex: 1 }} />
        <select value={newCol} onChange={e => setNewCol(e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 10px", fontSize: 12 }}>
          {columns.map(c => <option key={c} value={c}>{labels[c]}</option>)}
        </select>
        <Btn onClick={add} variant="primary">{Icons.plus}</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {columns.map(col => (
          <div key={col} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 10, minHeight: 300 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, fontFamily: theme.font, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
              {labels[col]} <Badge>{kanban.filter(c => c.col === col).length}</Badge>
            </div>
            {kanban.filter(c => c.col === col).map(card => (
              <div key={card.id} style={{ background: theme.bgHover, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: theme.text, marginBottom: 6 }}>{card.text}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {columns.filter(c => c !== col).map(c => <Btn key={c} small variant="ghost" onClick={() => move(card.id, c)} style={{ fontSize: 10, padding: "2px 6px" }}>{labels[c]}</Btn>)}
                  <span onClick={() => del(card.id)} style={{ cursor: "pointer", color: theme.textDim, marginLeft: "auto", display: "flex", alignItems: "center" }}>{Icons.trash}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Purchases (Compras & Importação) ───
function PurchasesView({ purchases, setPurchases }) {
  const [form, setForm] = useState({ supplier: "", po: "", product: "", value: "", eta: "", status: "pedido" });
  const sts = ["pedido", "produção", "embarcado", "aduana", "entregue"];

  const add = () => { if (!form.supplier.trim()) return; setPurchases(p => [...p, { ...form, id: Date.now() }]); setForm({ supplier: "", po: "", product: "", value: "", eta: "", status: "pedido" }); };
  const upd = (id, f, v) => setPurchases(p => p.map(x => x.id === id ? { ...x, [f]: v } : x));
  const del = id => setPurchases(p => p.filter(x => x.id !== id));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 16 }}>Compras & Importação</h2>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={form.supplier} onChange={v => setForm({ ...form, supplier: v })} placeholder="Fornecedor" style={{ flex: 2, minWidth: 140 }} />
          <Input value={form.po} onChange={v => setForm({ ...form, po: v })} placeholder="PO #" style={{ width: 90 }} />
          <Input value={form.product} onChange={v => setForm({ ...form, product: v })} placeholder="Produto" style={{ flex: 2, minWidth: 140 }} />
          <Input value={form.value} onChange={v => setForm({ ...form, value: v })} placeholder="Valor" style={{ width: 100 }} />
          <Input type="date" value={form.eta} onChange={v => setForm({ ...form, eta: v })} style={{ width: 140 }} />
          <Btn onClick={add} variant="primary">{Icons.plus}</Btn>
        </div>
      </div>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1fr 1fr 2fr 40px", gap: 0, padding: "8px 14px", background: theme.bgHover, fontSize: 11, fontWeight: 600, color: theme.textMuted, fontFamily: theme.font, textTransform: "uppercase" }}>
          <span>Fornecedor</span><span>PO</span><span>Produto</span><span>Valor</span><span>ETA</span><span>Status</span><span></span>
        </div>
        {purchases.map((p, i) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1fr 1fr 2fr 40px", gap: 0, padding: "10px 14px", borderTop: `1px solid ${theme.border}`, fontSize: 13, alignItems: "center", background: i % 2 === 0 ? "transparent" : theme.bgCard }}>
            <span style={{ color: theme.text }}>{p.supplier}</span>
            <span style={{ color: theme.textMuted, fontFamily: theme.font }}>{p.po}</span>
            <span style={{ color: theme.text }}>{p.product}</span>
            <span style={{ color: theme.amber, fontFamily: theme.font }}>{p.value}</span>
            <span style={{ color: theme.textMuted, fontFamily: theme.font }}>{p.eta}</span>
            <select value={p.status} onChange={e => upd(p.id, "status", e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "4px 6px", fontSize: 12 }}>
              {sts.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span onClick={() => del(p.id)} style={{ cursor: "pointer", color: theme.textDim, display: "flex", justifyContent: "center" }}>{Icons.trash}</span>
          </div>
        ))}
        {purchases.length === 0 && <p style={{ color: theme.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>Nenhum pedido cadastrado</p>}
      </div>
    </div>
  );
}

// ─── Meetings ───
function MeetingsView({ meetings, setMeetings }) {
  const [form, setForm] = useState({ subject: "", date: fmtDate(new Date()), time: "09:00", participants: "", notes: "", actions: "" });

  const add = () => { if (!form.subject.trim()) return; setMeetings(p => [...p, { ...form, id: Date.now() }]); setForm({ ...form, subject: "", participants: "", notes: "", actions: "" }); };
  const del = id => setMeetings(p => p.filter(x => x.id !== id));
  const upd = (id, f, v) => setMeetings(p => p.map(x => x.id === id ? { ...x, [f]: v } : x));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 16 }}>Reuniões</h2>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <Input value={form.subject} onChange={v => setForm({ ...form, subject: v })} placeholder="Assunto da reunião" style={{ flex: 1 }} />
          <Input type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} style={{ width: 140 }} />
          <Input type="time" value={form.time} onChange={v => setForm({ ...form, time: v })} style={{ width: 100 }} />
        </div>
        <Input value={form.participants} onChange={v => setForm({ ...form, participants: v })} placeholder="Participantes" style={{ marginBottom: 8 }} />
        <Btn onClick={add} variant="primary">{Icons.plus} Registrar reunião</Btn>
      </div>
      {meetings.map(m => (
        <div key={m.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 15, color: theme.text }}>{m.subject}</span>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, display: "flex", gap: 10 }}>
                <span>{Icons.calendar} {m.date}</span><span>{Icons.clock} {m.time}</span>
                {m.participants && <span>{Icons.user} {m.participants}</span>}
              </div>
            </div>
            <span onClick={() => del(m.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: theme.textDim, display: "block", marginBottom: 3 }}>Anotações / Decisões</label>
              <textarea value={m.notes || ""} onChange={e => upd(m.id, "notes", e.target.value)} rows={3} placeholder="Pautas, decisões..." style={{ width: "100%", background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 8, fontSize: 12, resize: "vertical", fontFamily: theme.fontSans, outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: theme.textDim, display: "block", marginBottom: 3 }}>Action Items</label>
              <textarea value={m.actions || ""} onChange={e => upd(m.id, "actions", e.target.value)} rows={3} placeholder="Quem / O quê / Prazo" style={{ width: "100%", background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 8, fontSize: 12, resize: "vertical", fontFamily: theme.fontSans, outline: "none" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Eisenhower Matrix ───
function EisenhowerView({ matrix, setMatrix }) {
  const quads = [
    { key: "do", title: "FAZER AGORA", sub: "Urgente + Importante", dark: true },
    { key: "schedule", title: "AGENDAR", sub: "Não urgente + Importante", dark: true },
    { key: "delegate", title: "DELEGAR", sub: "Urgente + Não importante", dark: false },
    { key: "eliminate", title: "ELIMINAR", sub: "Não urgente + Não importante", dark: false },
  ];
  const [newItem, setNewItem] = useState("");
  const [targetQ, setTargetQ] = useState("do");

  const add = () => { if (!newItem.trim()) return; setMatrix(p => [...p, { id: Date.now(), text: newItem, quad: targetQ, done: false }]); setNewItem(""); };
  const toggle = id => setMatrix(p => p.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const del = id => setMatrix(p => p.filter(x => x.id !== id));
  const move = (id, q) => setMatrix(p => p.map(x => x.id === id ? { ...x, quad: q } : x));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 12 }}>Matriz Eisenhower</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input value={newItem} onChange={setNewItem} placeholder="Nova atividade..." onKeyDown={e => e.key === "Enter" && add()} style={{ flex: 1 }} />
        <select value={targetQ} onChange={e => setTargetQ(e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 10px", fontSize: 12 }}>
          {quads.map(q => <option key={q.key} value={q.key}>{q.title}</option>)}
        </select>
        <Btn onClick={add} variant="primary">{Icons.plus}</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {quads.map(q => (
          <div key={q.key} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, minHeight: 200 }}>
            <div style={{ background: q.dark ? theme.bg : theme.bgHover, padding: "8px 14px", borderRadius: "10px 10px 0 0" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: q.dark ? theme.text : theme.textMuted }}>{q.title}</div>
              <div style={{ fontSize: 10, color: theme.textDim }}>{q.sub}</div>
            </div>
            <div style={{ padding: "8px 12px" }}>
              {matrix.filter(x => x.quad === q.key).map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <div onClick={() => toggle(item.id)} style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${item.done ? theme.green : theme.border}`, background: item.done ? theme.greenBg : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {item.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={theme.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, color: item.done ? theme.textDim : theme.text, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                  <span onClick={() => del(item.id)} style={{ cursor: "pointer", color: theme.textDim, display: "flex" }}>{Icons.trash}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Habits Tracker ───
function HabitsView({ habits, setHabits }) {
  const [newHabit, setNewHabit] = useState("");
  const today = new Date(); const year = today.getFullYear(); const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const add = () => { if (!newHabit.trim()) return; setHabits(p => [...p, { id: Date.now(), name: newHabit, checks: {} }]); setNewHabit(""); };
  const toggle = (id, day) => setHabits(p => p.map(h => h.id === id ? { ...h, checks: { ...h.checks, [day]: !h.checks[day] } } : h));
  const del = id => setHabits(p => p.filter(h => h.id !== id));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Hábitos — {monthNames[month]}</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input value={newHabit} onChange={setNewHabit} placeholder="Novo hábito..." onKeyDown={e => e.key === "Enter" && add()} style={{ flex: 1 }} />
        <Btn onClick={add} variant="primary">{Icons.plus}</Btn>
      </div>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${daysInMonth}, 28px) 50px`, fontSize: 10, minWidth: daysInMonth * 28 + 200 }}>
          <div style={{ padding: "8px 10px", fontWeight: 600, color: theme.textMuted, background: theme.bgHover }}>Hábito</div>
          {days.map(d => <div key={d} style={{ padding: "8px 0", textAlign: "center", fontWeight: 600, color: d === today.getDate() ? theme.accent : theme.textMuted, background: d === today.getDate() ? theme.accentBg : theme.bgHover, fontFamily: theme.font }}>{d}</div>)}
          <div style={{ padding: "8px 4px", textAlign: "center", fontWeight: 600, color: theme.textMuted, background: theme.bgHover }}>Total</div>
          {habits.map(h => { const total = Object.values(h.checks).filter(Boolean).length; return (
            <React.Fragment key={h.id}>
              <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 4, borderTop: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 12, color: theme.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                <span onClick={() => del(h.id)} style={{ cursor: "pointer", color: theme.textDim, flexShrink: 0 }}>{Icons.trash}</span>
              </div>
              {days.map(d => (
                <div key={d} onClick={() => toggle(h.id, d)} style={{ display: "flex", alignItems: "center", justifyContent: "center", borderTop: `1px solid ${theme.border}`, cursor: "pointer", background: h.checks[d] ? theme.greenBg : "transparent" }}>
                  {h.checks[d] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.green} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderTop: `1px solid ${theme.border}`, fontWeight: 600, fontSize: 12, color: total > 0 ? theme.green : theme.textDim, fontFamily: theme.font }}>{total}</div>
            </React.Fragment>
          ); })}
        </div>
      </div>
    </div>
  );
}

// ─── Finance (Smart with Screenshot OCR) ───
const BANKS = ["Nubank","Sicredi","Banco do Brasil","Avenue (USD)","Nomad (USD)","Outro"];
const CATEGORIES = [
  { id: "alimentacao", label: "Alimentação", icon: "🍽" },
  { id: "delivery", label: "Delivery", icon: "🛵" },
  { id: "transporte", label: "Transporte", icon: "🚗" },
  { id: "moradia", label: "Moradia", icon: "🏠" },
  { id: "saude", label: "Saúde", icon: "💊" },
  { id: "educacao", label: "Educação", icon: "📚" },
  { id: "lazer", label: "Lazer", icon: "🎮" },
  { id: "assinaturas", label: "Assinaturas", icon: "📺" },
  { id: "compras", label: "Compras", icon: "🛒" },
  { id: "tarifas", label: "Tarifas bancárias", icon: "🏦" },
  { id: "impostos", label: "Impostos/Tributos", icon: "📋" },
  { id: "investimento", label: "Investimentos", icon: "📈" },
  { id: "salario", label: "Salário", icon: "💰" },
  { id: "freelance", label: "Freelance/Consultoria", icon: "💼" },
  { id: "transferencia", label: "Transferência", icon: "↔" },
  { id: "aquario", label: "Aquário", icon: "🐠" },
  { id: "pesca", label: "Pesca", icon: "🎣" },
  { id: "gaita", label: "Gaita", icon: "🎵" },
  { id: "pets", label: "Pets", icon: "🐾" },
  { id: "outros", label: "Outros", icon: "📦" },
];

// Auto-classification rules
const CLASS_RULES = [
  { patterns: ["ifood","rappi","99food","zé delivery","uber eats"], cat: "delivery" },
  { patterns: ["uber","99","cabify","lyft"], cat: "transporte" },
  { patterns: ["netflix","spotify","disney","hbo","prime video","youtube","amazon prime","chatgpt","claude","openai"], cat: "assinaturas" },
  { patterns: ["mercado","supermercado","carrefour","pão de açúcar","assaí","atacadão","extra","big"], cat: "alimentacao" },
  { patterns: ["restaurante","rest.","lanchonete","padaria","café","burger","pizza","sushi"], cat: "alimentacao" },
  { patterns: ["posto","shell","ipiranga","br ","petrobras","gasolina","combustível","estacionamento"], cat: "transporte" },
  { patterns: ["farmácia","drogaria","droga","hospital","clínica","médico","lab ","laborat","unimed","amil"], cat: "saude" },
  { patterns: ["tar ","tarifa","anuidade","iof","taxa "], cat: "tarifas" },
  { patterns: ["das ","inss","fgts","iptu","ipva","detran","licenciamento","imposto"], cat: "impostos" },
  { patterns: ["pix enviado","pix recebido","transferencia","ted ","doc "], cat: "transferencia" },
  { patterns: ["salário","pagamento","folha","holerite"], cat: "salario" },
  { patterns: ["amazon","mercado livre","magalu","magazine","shopee","aliexpress","shein"], cat: "compras" },
  { patterns: ["energia","enel","cpfl","água","sabesp","gás","comgás","internet","vivo","claro","tim","oi ","net ","aluguel","condomínio"], cat: "moradia" },
];

function classifyTransaction(desc) {
  const lower = (desc || "").toLowerCase();
  for (const rule of CLASS_RULES) {
    if (rule.patterns.some(p => lower.includes(p))) return rule.cat;
  }
  return "outros";
}

function FinanceView({ finance, setFinance, accounts, setAccounts }) {
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ date: fmtDate(new Date()), desc: "", cat: "", type: "saida", value: "", bank: "Nubank" });
  const [filterBank, setFilterBank] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState(fmtDate(new Date()).slice(0, 7));
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState([]);
  const [importBank, setImportBank] = useState("Nubank");
  const [importMsg, setImportMsg] = useState("");
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [accForm, setAccForm] = useState({ name: "", balance: "", currency: "BRL" });

  // Account helpers
  const addAccount = () => {
    if (!accForm.name.trim()) return;
    setAccounts(p => [...p, { id: Date.now(), name: accForm.name, initialBalance: parseFloat(accForm.balance) || 0, currency: accForm.currency }]);
    setAccForm({ name: "", balance: "", currency: "BRL" });
  };
  const delAccount = id => setAccounts(p => p.filter(a => a.id !== id));
  const updAccount = (id, f, v) => setAccounts(p => p.map(a => a.id === id ? { ...a, [f]: v } : a));

  const getAccountBalance = (bankName) => {
    const acc = accounts.find(a => a.name === bankName);
    const initial = acc?.initialBalance || 0;
    const txIn = finance.filter(f => f.bank === bankName && f.type === "entrada").reduce((s, f) => s + (f.value || 0), 0);
    const txOut = finance.filter(f => f.bank === bankName && f.type === "saida").reduce((s, f) => s + (f.value || 0), 0);
    return { initial, current: initial + txIn - txOut, currency: acc?.currency || "BRL", txIn, txOut };
  };

  // Manual add
  const add = () => {
    if (!form.desc.trim() || !form.value) return;
    const cat = form.cat || classifyTransaction(form.desc);
    setFinance(p => [...p, { ...form, cat, id: Date.now(), value: parseFloat(form.value) || 0 }]);
    setForm({ ...form, desc: "", value: "", cat: "" });
  };
  const del = id => setFinance(p => p.filter(x => x.id !== id));
  const upd = (id, f, v) => setFinance(p => p.map(x => x.id === id ? { ...x, [f]: v } : x));

  // Screenshot OCR
  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      const mediaType = file.type || "image/png";
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 2000,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: `Analise este extrato bancário (${importBank}) e extraia TODAS as transações visíveis.
Para cada transação, retorne APENAS um JSON array com objetos no formato:
[{"date":"YYYY-MM-DD","desc":"descrição original","value":99.99,"type":"saida ou entrada"}]
- "type" deve ser "entrada" para créditos/depósitos/PIX recebido e "saida" para débitos/pagamentos/PIX enviado
- "value" deve ser sempre positivo (número)
- "date" no formato YYYY-MM-DD
- Se não conseguir determinar o ano, use 2026
Retorne APENAS o JSON, sem explicações.` }
          ]}],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const classified = parsed.map(t => ({
          ...t,
          id: Date.now() + Math.random(),
          bank: importBank,
          cat: classifyTransaction(t.desc),
          value: Math.abs(parseFloat(t.value) || 0),
          confirmed: false,
        }));
        setPreview(classified);
        setTab("import");
      } else {
        setImportMsg("Não consegui extrair transações. Tente com outro print.");
      }
    } catch (err) {
      console.error(err);
      setImportMsg("Erro ao processar: " + err.message);
    }
    setImporting(false);
  };

  // Confirm import
  const confirmImport = () => {
    const toImport = preview.filter(t => t.confirmed !== false);
    setFinance(p => [...p, ...toImport.map(t => ({ ...t, id: Date.now() + Math.random() }))]);
    setPreview([]);
    setTab("overview");
  };

  // AI Insights
  const getInsights = async () => {
    setLoadingInsights(true);
    const monthData = finance.filter(f => f.date?.startsWith(filterMonth));
    const summary = {};
    monthData.forEach(f => {
      const cat = CATEGORIES.find(c => c.id === f.cat)?.label || f.cat || "Outros";
      if (!summary[cat]) summary[cat] = { in: 0, out: 0 };
      if (f.type === "entrada") summary[cat].in += f.value; else summary[cat].out += f.value;
    });
    const sumText = Object.entries(summary).map(([k, v]) => `${k}: entradas R$${v.in.toFixed(0)}, saídas R$${v.out.toFixed(0)}`).join("; ");
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 600,
        messages: [{ role: "user", content: `Analise estes gastos do mês ${filterMonth} e dê insights práticos em português. Dados por categoria: ${sumText}. Total transações: ${monthData.length}. Dê 3-4 insights curtos e acionáveis sobre padrões, alertas e oportunidades de economia. Seja direto.` }]
      }) });
      const data = await res.json();
      setInsights(data.content?.[0]?.text || "Sem insights disponíveis");
    } catch { setInsights("Erro ao gerar insights"); }
    setLoadingInsights(false);
  };

  // Calculations
  const filtered = finance.filter(f => {
    if (filterBank !== "all" && f.bank !== filterBank) return false;
    if (filterCat !== "all" && f.cat !== filterCat) return false;
    if (filterMonth && !f.date?.startsWith(filterMonth)) return false;
    return true;
  }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const totalIn = filtered.filter(f => f.type === "entrada").reduce((s, f) => s + (f.value || 0), 0);
  const totalOut = filtered.filter(f => f.type === "saida").reduce((s, f) => s + (f.value || 0), 0);

  // Category breakdown
  const catBreakdown = {};
  filtered.filter(f => f.type === "saida").forEach(f => {
    const cat = f.cat || "outros";
    catBreakdown[cat] = (catBreakdown[cat] || 0) + (f.value || 0);
  });
  const sortedCats = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Financeiro Inteligente</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {[["overview","Visão geral"],["transactions","Lançamentos"],["import","Importar"],["accounts","Contas"]].map(([k,l]) => (
            <Btn key={k} small variant={tab===k?"primary":"default"} onClick={() => setTab(k)}>{l}</Btn>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {(() => {
          const totalInitial = accounts.reduce((s, a) => s + (a.initialBalance || 0), 0);
          const patrimonio = totalInitial + totalIn - totalOut;
          return [
            { l: "Entradas", v: `R$ ${totalIn.toFixed(2)}`, c: theme.green },
            { l: "Saídas", v: `R$ ${totalOut.toFixed(2)}`, c: theme.red },
            { l: "Saldo mês", v: `R$ ${(totalIn - totalOut).toFixed(2)}`, c: totalIn - totalOut >= 0 ? theme.green : theme.red },
            { l: "Patrimônio", v: `R$ ${patrimonio.toFixed(2)}`, c: theme.accent },
          ];
        })().map((m, i) => (
          <div key={i} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase" }}>{m.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.c, fontFamily: theme.font }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <Input type="month" value={filterMonth} onChange={setFilterMonth} style={{ width: 150 }} />
        <select value={filterBank} onChange={e => setFilterBank(e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
          <option value="all">Todos os bancos</option>
          {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
          <option value="all">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <Btn small onClick={getInsights} variant="default" disabled={loadingInsights} style={{ marginLeft: "auto" }}>
          {loadingInsights ? "Analisando..." : "IA Insights"}
        </Btn>
      </div>

      {/* AI Insights */}
      {insights && (
        <div style={{ background: theme.accentBg, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13, color: theme.text, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.accent, marginBottom: 6, fontFamily: theme.font }}>INSIGHTS DO MÊS</div>
          {insights}
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Category breakdown */}
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 12, fontFamily: theme.font }}>GASTOS POR CATEGORIA</h3>
            {sortedCats.map(([catId, val]) => {
              const catInfo = CATEGORIES.find(c => c.id === catId) || { icon: "📦", label: catId };
              const pct = totalOut > 0 ? Math.round(val / totalOut * 100) : 0;
              return (
                <div key={catId} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: theme.text }}>{catInfo.icon} {catInfo.label}</span>
                    <span style={{ color: theme.red, fontFamily: theme.font, fontWeight: 600 }}>R$ {val.toFixed(2)} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: theme.bgHover, borderRadius: 3 }}>
                    <div style={{ height: 6, background: theme.red, borderRadius: 3, width: `${pct}%`, opacity: 0.7, transition: "width 0.3s" }} />
                  </div>
                </div>
              );
            })}
            {sortedCats.length === 0 && <p style={{ color: theme.textDim, fontSize: 12 }}>Sem gastos no período</p>}
          </div>

          {/* By bank - with account balances */}
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 12, fontFamily: theme.font }}>SALDO POR CONTA</h3>
            {accounts.length === 0 ? (
              <div>
                <p style={{ color: theme.textDim, fontSize: 12, marginBottom: 8 }}>Configure suas contas na aba "Contas" para ver os saldos.</p>
                <Btn small variant="ghost" onClick={() => setTab("accounts")}>Configurar contas</Btn>
              </div>
            ) : accounts.map(acc => {
              const bal = getAccountBalance(acc.name);
              const cur = acc.currency === "USD" ? "US$" : "R$";
              return (
                <div key={acc.id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{acc.name}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: bal.current >= 0 ? theme.green : theme.red, fontFamily: theme.font }}>
                      {cur} {bal.current.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11 }}>
                    <span style={{ color: theme.textDim }}>Inicial: {cur} {bal.initial.toFixed(2)}</span>
                    <span style={{ color: theme.green }}>+{cur} {bal.txIn.toFixed(2)}</span>
                    <span style={{ color: theme.red }}>-{cur} {bal.txOut.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {tab === "transactions" && (
        <div>
          {/* Manual entry */}
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Input type="date" value={form.date} onChange={v => setForm({...form,date:v})} style={{ width: 130 }} />
              <select value={form.bank} onChange={e => setForm({...form,bank:e.target.value})} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 6px", fontSize: 11 }}>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <Input value={form.desc} onChange={v => setForm({...form,desc:v})} placeholder="Descrição" style={{ flex: 2, minWidth: 120 }} />
              <select value={form.type} onChange={e => setForm({...form,type:e.target.value})} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 6px", fontSize: 11 }}>
                <option value="saida">Saída</option><option value="entrada">Entrada</option>
              </select>
              <Input value={form.value} onChange={v => setForm({...form,value:v})} placeholder="Valor" type="number" style={{ width: 90 }} />
              <Btn small onClick={add} variant="primary">{Icons.plus}</Btn>
            </div>
          </div>

          {/* Transaction list */}
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "0 12px" }}>
            {filtered.map(f => {
              const catInfo = CATEGORIES.find(c => c.id === f.cat) || { icon: "📦", label: f.cat || "Outros" };
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 12 }}>
                  <span style={{ fontFamily: theme.font, color: theme.textDim, width: 70, flexShrink: 0 }}>{f.date}</span>
                  <span style={{ width: 20, textAlign: "center", flexShrink: 0 }}>{catInfo.icon}</span>
                  <span style={{ flex: 1, color: theme.text }}>{f.desc}</span>
                  <select value={f.cat || "outros"} onChange={e => upd(f.id, "cat", e.target.value)} style={{ background: "transparent", color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "2px 4px", fontSize: 10, maxWidth: 100 }}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  {f.bank && <span style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font }}>{f.bank}</span>}
                  <span style={{ fontWeight: 600, color: f.type === "entrada" ? theme.green : theme.red, fontFamily: theme.font, minWidth: 80, textAlign: "right" }}>
                    {f.type === "entrada" ? "+" : "-"} R$ {(f.value || 0).toFixed(2)}
                  </span>
                  <span onClick={() => del(f.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
                </div>
              );
            })}
            {filtered.length === 0 && <p style={{ color: theme.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>Nenhuma transação no período</p>}
          </div>
        </div>
      )}

      {/* IMPORT TAB */}
      {tab === "import" && (
        <div>
          <div style={{ background: theme.bgCard, border: `2px dashed ${theme.accent}`, borderRadius: 10, padding: 24, textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Importar extrato via Screenshot</div>
            <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 14 }}>Tire um print do extrato no app do banco e faça upload aqui. A IA extrai e classifica automaticamente.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
              <select value={importBank} onChange={e => setImportBank(e.target.value)} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: theme.accent, color: "#fff", borderRadius: 6, cursor: importing ? "wait" : "pointer", fontSize: 13, fontWeight: 500, opacity: importing ? 0.6 : 1 }}>
                <input type="file" accept="image/*" onChange={handleScreenshot} disabled={importing} style={{ display: "none" }} />
                {importing ? "Processando..." : "Enviar Screenshot"}
              </label>
            </div>
            <div style={{ fontSize: 11, color: theme.textDim }}>Aceita: PNG, JPG, HEIC — Funciona com Nubank, Sicredi, BB, Avenue, Nomad</div>
          </div>
          {importMsg && (
            <div style={{ background: theme.redBg, border: `1px solid ${theme.red}`, borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: theme.red, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{importMsg}</span>
              <Btn small variant="ghost" onClick={() => setImportMsg("")}>{Icons.x}</Btn>
            </div>
          )}

          {/* Preview imported transactions */}
          {preview.length > 0 && (
            <div style={{ background: theme.bgCard, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{preview.length} transações encontradas</span>
                  <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 8 }}>({importBank})</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn small variant="ghost" onClick={() => setPreview([])}>Cancelar</Btn>
                  <Btn small variant="primary" onClick={confirmImport}>Confirmar importação</Btn>
                </div>
              </div>
              {preview.map((t, i) => {
                const catInfo = CATEGORIES.find(c => c.id === t.cat) || { icon: "📦", label: "Outros" };
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 12 }}>
                    <input type="checkbox" checked={t.confirmed !== false} onChange={e => { const np = [...preview]; np[i] = { ...np[i], confirmed: e.target.checked }; setPreview(np); }} />
                    <span style={{ fontFamily: theme.font, color: theme.textDim, width: 70 }}>{t.date}</span>
                    <span style={{ width: 18 }}>{catInfo.icon}</span>
                    <span style={{ flex: 1, color: theme.text }}>{t.desc}</span>
                    <select value={t.cat} onChange={e => { const np = [...preview]; np[i] = { ...np[i], cat: e.target.value }; setPreview(np); }} style={{ background: "transparent", color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "2px 4px", fontSize: 10 }}>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <span style={{ fontWeight: 600, color: t.type === "entrada" ? theme.green : theme.red, fontFamily: theme.font }}>
                      {t.type === "entrada" ? "+" : "-"} R$ {(t.value || 0).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ACCOUNTS TAB */}
      {tab === "accounts" && (
        <div>
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 10, fontFamily: theme.font }}>Adicionar conta bancária</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Input value={accForm.name} onChange={v => setAccForm({...accForm, name: v})} placeholder="Nome do banco (ex: Nubank)" style={{ flex: 2, minWidth: 150 }} />
              <Input value={accForm.balance} onChange={v => setAccForm({...accForm, balance: v})} placeholder="Saldo inicial" type="number" style={{ width: 130 }} />
              <select value={accForm.currency} onChange={e => setAccForm({...accForm, currency: e.target.value})} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 10px", fontSize: 12 }}>
                <option value="BRL">R$ (BRL)</option>
                <option value="USD">US$ (USD)</option>
              </select>
              <Btn onClick={addAccount} variant="primary">{Icons.plus} Adicionar</Btn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {accounts.map(acc => {
              const bal = getAccountBalance(acc.name);
              const cur = acc.currency === "USD" ? "US$" : "R$";
              return (
                <div key={acc.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{acc.name}</div>
                      <Badge>{acc.currency}</Badge>
                    </div>
                    <span onClick={() => delAccount(acc.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
                  </div>

                  <div style={{ background: theme.bgHover, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase" }}>Saldo atual</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: bal.current >= 0 ? theme.green : theme.red, fontFamily: theme.font }}>
                      {cur} {bal.current.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
                    <div style={{ textAlign: "center", background: theme.bg, borderRadius: 4, padding: 6 }}>
                      <div style={{ color: theme.textDim }}>Inicial</div>
                      <div style={{ color: theme.text, fontWeight: 600, fontFamily: theme.font }}>{cur} {bal.initial.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: "center", background: theme.bg, borderRadius: 4, padding: 6 }}>
                      <div style={{ color: theme.textDim }}>Entradas</div>
                      <div style={{ color: theme.green, fontWeight: 600, fontFamily: theme.font }}>+{cur} {bal.txIn.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: "center", background: theme.bg, borderRadius: 4, padding: 6 }}>
                      <div style={{ color: theme.textDim }}>Saídas</div>
                      <div style={{ color: theme.red, fontWeight: 600, fontFamily: theme.font }}>-{cur} {bal.txOut.toFixed(2)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 10, color: theme.textDim }}>Ajustar saldo inicial:</label>
                    <Input value={acc.initialBalance} onChange={v => updAccount(acc.id, "initialBalance", parseFloat(v) || 0)} type="number" style={{ marginTop: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {accounts.length === 0 && (
            <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 24, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: theme.textMuted, marginBottom: 8 }}>Nenhuma conta cadastrada</p>
              <p style={{ fontSize: 12, color: theme.textDim }}>Adicione suas contas bancárias acima para acompanhar o saldo de cada uma.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Brainstorm ───
function BrainstormView({ ideas, setIdeas }) {
  const [newIdea, setNewIdea] = useState("");
  const colors = ["accent", "green", "amber", "red"];

  const add = () => { if (!newIdea.trim()) return; setIdeas(p => [...p, { id: Date.now(), text: newIdea, color: colors[Math.floor(Math.random() * 4)], notes: "" }]); setNewIdea(""); };
  const del = id => setIdeas(p => p.filter(x => x.id !== id));
  const upd = (id, f, v) => setIdeas(p => p.map(x => x.id === id ? { ...x, [f]: v } : x));

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 16 }}>Brainstorm</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input value={newIdea} onChange={setNewIdea} placeholder="Nova ideia..." onKeyDown={e => e.key === "Enter" && add()} style={{ flex: 1 }} />
        <Btn onClick={add} variant="primary">{Icons.plus} Ideia</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {ideas.map(idea => (
          <div key={idea.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, borderLeft: `4px solid ${theme[idea.color]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{idea.text}</span>
              <span onClick={() => del(idea.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
            </div>
            <textarea value={idea.notes} onChange={e => upd(idea.id, "notes", e.target.value)} placeholder="Detalhes..." rows={3} style={{ width: "100%", background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4, padding: 8, fontSize: 12, resize: "vertical", fontFamily: theme.fontSans, outline: "none" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Health Tracker ───
function HealthView({ health, setHealth }) {
  const todayStr = fmtDate(new Date());
  const today = health.find(h => h.date === todayStr) || { date: todayStr, water: 0, sleep: "", energy: 0, exercise: "", mood: 0, notes: "" };

  const save = (field, value) => {
    setHealth(prev => {
      const exists = prev.find(h => h.date === todayStr);
      if (exists) return prev.map(h => h.date === todayStr ? { ...h, [field]: value } : h);
      return [...prev, { ...today, [field]: value }];
    });
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return fmtDate(d); });

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 16 }}>Saúde — Hoje</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font, marginBottom: 8 }}>ÁGUA (COPOS)</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} onClick={() => save("water", i + 1)} style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${i < today.water ? theme.accent : theme.border}`, background: i < today.water ? theme.accentBg : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: i < today.water ? theme.accent : theme.textDim, fontFamily: theme.font }}>{i + 1}</div>
            ))}
          </div>
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font, marginBottom: 8 }}>ENERGIA (1-5)</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} onClick={() => save("energy", n)} style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${n <= today.energy ? theme.amber : theme.border}`, background: n <= today.energy ? theme.amberBg : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: n <= today.energy ? theme.amber : theme.textDim }}>{n}</div>
            ))}
          </div>
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font, marginBottom: 8 }}>HUMOR (1-5)</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["😫", "😕", "😐", "😊", "😁"].map((e, i) => (
              <div key={i} onClick={() => save("mood", i + 1)} style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${i + 1 <= today.mood ? theme.green : theme.border}`, background: i + 1 <= today.mood ? theme.greenBg : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{e}</div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <label style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font }}>SONO (HORAS)</label>
          <Input value={today.sleep} onChange={v => save("sleep", v)} placeholder="Ex: 7h30" style={{ marginTop: 6 }} />
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <label style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font }}>EXERCÍCIO</label>
          <Input value={today.exercise} onChange={v => save("exercise", v)} placeholder="Tipo e duração" style={{ marginTop: 6 }} />
        </div>
      </div>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
        <label style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font }}>RESUMO DA SEMANA</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 8 }}>
          {weekDays.map(d => { const h = health.find(x => x.date === d) || {}; const isToday = d === todayStr; return (
            <div key={d} style={{ background: isToday ? theme.accentBg : theme.bgHover, border: `1px solid ${isToday ? theme.accent : theme.border}`, borderRadius: 6, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: theme.textMuted, fontFamily: theme.font }}>{d.slice(5)}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: theme.textMuted }}>💧{h.water || 0} ⚡{h.energy || 0}</div>
            </div>
          ); })}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───

// ─── Films & Series ───
function FilmsView({ films, setFilms }) {
  const [tab, setTab] = useState("watchlist");
  const [form, setForm] = useState({ title: "", genre: "", notes: "", rating: 0, type: "filme" });
  const genres = ["Ação","Comédia","Drama","Ficção","Terror","Documentário","Thriller","Animação","Outro"];

  const add = () => { if (!form.title.trim()) return; setFilms(p => [...p, { ...form, id: Date.now(), status: tab === "watched" ? "watched" : "watchlist", date: tab === "watched" ? fmtDate(new Date()) : "" }]); setForm({ ...form, title: "", notes: "", rating: 0 }); };
  const upd = (id, f, v) => setFilms(p => p.map(x => x.id === id ? { ...x, [f]: v } : x));
  const del = id => setFilms(p => p.filter(x => x.id !== id));
  const markWatched = id => setFilms(p => p.map(x => x.id === id ? { ...x, status: "watched", date: fmtDate(new Date()) } : x));

  const filtered = films.filter(f => f.status === tab);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  const getSuggestion = async () => {
    setLoadingAi(true);
    const watched = films.filter(f => f.status === "watched" && f.rating >= 4).map(f => `${f.title} (${f.genre}, nota ${f.rating})`).join(", ");
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 500, messages: [{ role: "user", content: `Baseado nestes filmes que eu gostei: ${watched || "variados"}. Sugira 3 filmes/séries que eu provavelmente vou gostar. Seja breve, 1 linha por sugestão com título e motivo.` }] }) });
      const data = await res.json();
      setAiSuggestion(data.content?.[0]?.text || "Sem sugestões no momento");
    } catch { setAiSuggestion("Erro ao buscar sugestões"); }
    setLoadingAi(false);
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 12 }}>Filmes & Séries</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["watchlist","Quero assistir"],["watched","Assistidos"]].map(([k,l]) => <Btn key={k} small variant={tab===k?"primary":"default"} onClick={() => setTab(k)}>{l} ({films.filter(f=>f.status===k).length})</Btn>)}
        <Btn small variant="ghost" onClick={getSuggestion} disabled={loadingAi} style={{ marginLeft: "auto" }}>{loadingAi ? "Pensando..." : "IA Sugestões"}</Btn>
      </div>
      {aiSuggestion && <div style={{ background: theme.accentBg, border: `1px solid ${theme.accent}`, borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: theme.text, whiteSpace: "pre-wrap" }}>{aiSuggestion}</div>}
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={form.title} onChange={v => setForm({...form,title:v})} placeholder="Título" style={{ flex: 2, minWidth: 160 }} />
          <select value={form.type} onChange={e => setForm({...form,type:e.target.value})} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 8px", fontSize: 12 }}>
            <option value="filme">Filme</option><option value="serie">Série</option><option value="doc">Doc</option>
          </select>
          <select value={form.genre} onChange={e => setForm({...form,genre:e.target.value})} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 8px", fontSize: 12 }}>
            <option value="">Gênero</option>{genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {tab === "watched" && <div style={{ display: "flex", alignItems: "center", gap: 1 }}>{[1,2,3,4,5].map(n => <span key={n} onClick={() => setForm({...form,rating:n})} style={{ cursor: "pointer", fontSize: 18, color: n<=form.rating ? theme.amber : theme.textDim }}>★</span>)}</div>}
          <Btn onClick={add} variant="primary">{Icons.plus}</Btn>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
        {filtered.map(f => (
          <div key={f.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{f.title}</span>
              <span onClick={() => del(f.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <Badge>{f.type}</Badge>
              {f.genre && <Badge color="amber">{f.genre}</Badge>}
              {f.date && <span style={{ fontSize: 11, color: theme.textDim }}>{f.date}</span>}
            </div>
            {f.status === "watched" && <div style={{ color: theme.amber, fontSize: 14 }}>{"★".repeat(f.rating)}{"☆".repeat(5-f.rating)}</div>}
            {f.status === "watchlist" && <Btn small variant="ghost" onClick={() => markWatched(f.id)}>Marcar assistido</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Books (enhanced) ───
function BooksView({ books, setBooks, goals, setGoals }) {
  const [form, setForm] = useState({ title: "", author: "", pages: 0, currentPage: 0, notes: "", rating: 0, status: "reading" });
  const year = new Date().getFullYear();
  const yearGoal = goals.find(g => g.scope === "books" && g.year === year);
  const readThisYear = books.filter(b => b.status === "done" && b.doneDate?.startsWith(String(year))).length;

  const add = () => { if (!form.title.trim()) return; setBooks(p => [...p, { ...form, id: Date.now(), startDate: fmtDate(new Date()), doneDate: "" }]); setForm({ ...form, title: "", author: "", pages: 0, currentPage: 0, notes: "", rating: 0 }); };
  const upd = (id, f, v) => setBooks(p => p.map(x => x.id === id ? { ...x, [f]: v } : x));
  const finish = id => setBooks(p => p.map(x => x.id === id ? { ...x, status: "done", doneDate: fmtDate(new Date()), currentPage: x.pages } : x));
  const del = id => setBooks(p => p.filter(x => x.id !== id));
  const [yearGoalInput, setYearGoalInput] = useState("");
  const [showYearGoalInput, setShowYearGoalInput] = useState(false);
  const setYearGoal = () => {
    const n = parseInt(yearGoalInput);
    if (!n || n < 1) return;
    if (yearGoal) setGoals(p => p.map(g => g.id === yearGoal.id ? { ...g, target: n } : g));
    else setGoals(p => [...p, { id: Date.now(), scope: "books", year, target: n, progress: 0 }]);
    setYearGoalInput(""); setShowYearGoalInput(false);
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Livros & Leituras</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: theme.textMuted }}>Meta {year}:</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: theme.accent, fontFamily: theme.font }}>{readThisYear}/{yearGoal?.target || "?"}</span>
          <Btn small variant="ghost" onClick={() => setShowYearGoalInput(!showYearGoalInput)}>{Icons.edit}</Btn>
        </div>
        {showYearGoalInput && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: theme.textMuted }}>Quantos livros em {year}?</span>
            <Input value={yearGoalInput} onChange={setYearGoalInput} placeholder="Ex: 12" type="number" onKeyDown={e => { if (e.key === "Enter") setYearGoal(); }} autoFocus style={{ width: 80 }} />
            <Btn small variant="primary" onClick={setYearGoal}>OK</Btn>
            <Btn small variant="ghost" onClick={() => setShowYearGoalInput(false)}>{Icons.x}</Btn>
          </div>
        )}
      </div>
      {yearGoal && <div style={{ height: 6, background: theme.bgHover, borderRadius: 3, marginBottom: 16 }}><div style={{ height: 6, background: readThisYear >= (yearGoal.target||1) ? theme.green : theme.accent, borderRadius: 3, width: `${Math.min(100, Math.round(readThisYear / (yearGoal.target||1) * 100))}%` }} /></div>}
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={form.title} onChange={v => setForm({...form,title:v})} placeholder="Título" style={{ flex: 2, minWidth: 160 }} />
          <Input value={form.author} onChange={v => setForm({...form,author:v})} placeholder="Autor" style={{ flex: 1, minWidth: 120 }} />
          <Input value={form.pages || ""} onChange={v => setForm({...form,pages:parseInt(v)||0})} placeholder="Páginas" type="number" style={{ width: 80 }} />
          <Btn onClick={add} variant="primary">{Icons.plus}</Btn>
        </div>
      </div>
      {books.map(b => { const pct = b.pages > 0 ? Math.round((b.currentPage / b.pages) * 100) : 0; return (
        <div key={b.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{b.title}</span>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{b.author} {b.pages > 0 && `· ${b.pages}p`}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Badge color={b.status === "done" ? "green" : b.status === "reading" ? "accent" : "amber"}>{b.status === "done" ? "Lido" : b.status === "reading" ? "Lendo" : "Fila"}</Badge>
              <span onClick={() => del(b.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
            </div>
          </div>
          {b.status === "reading" && b.pages > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <input type="range" min="0" max={b.pages} value={b.currentPage} onChange={e => upd(b.id, "currentPage", parseInt(e.target.value))} style={{ flex: 1, accentColor: theme.accent }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.accent, fontFamily: theme.font, minWidth: 40 }}>{pct}%</span>
              {pct >= 100 && <Btn small variant="primary" onClick={() => finish(b.id)}>Concluir</Btn>}
            </div>
          )}
          {b.status === "done" && <div style={{ color: theme.amber, marginTop: 6 }}>{[1,2,3,4,5].map(n => <span key={n} onClick={() => upd(b.id,"rating",n)} style={{ cursor: "pointer", fontSize: 16 }}>{n <= (b.rating||0) ? "★" : "☆"}</span>)}</div>}
        </div>
      ); })}
    </div>
  );
}

// ─── Fishing ───
function FishingView({ fishing, setFishing }) {
  const [form, setForm] = useState({ date: fmtDate(new Date()), location: "", conditions: "", species: "", bait: "", weight: "", notes: "", rating: 3 });

  const add = () => { if (!form.location.trim()) return; setFishing(p => [...p, { ...form, id: Date.now() }]); setForm({ ...form, location: "", species: "", bait: "", weight: "", notes: "" }); };
  const del = id => setFishing(p => p.filter(x => x.id !== id));
  const total = fishing.length;
  const species = [...new Set(fishing.map(f => f.species).filter(Boolean))];

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 14 }}>Diário de Pesca</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {[{ l: "Total saídas", v: total, c: theme.accent }, { l: "Espécies", v: species.length, c: theme.green }, { l: "Último", v: fishing[0]?.date || "-", c: theme.text }].map((m, i) => (
          <div key={i} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase" }}>{m.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: theme.font }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 10, fontFamily: theme.font }}>Nova saída de pesca</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <Input type="date" value={form.date} onChange={v => setForm({...form,date:v})} style={{ width: 140 }} />
          <Input value={form.location} onChange={v => setForm({...form,location:v})} placeholder="Local (rio, represa...)" style={{ flex: 1, minWidth: 160 }} />
          <Input value={form.conditions} onChange={v => setForm({...form,conditions:v})} placeholder="Clima/condições" style={{ width: 140 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <Input value={form.species} onChange={v => setForm({...form,species:v})} placeholder="Espécie(s) pescada(s)" style={{ flex: 1 }} />
          <Input value={form.bait} onChange={v => setForm({...form,bait:v})} placeholder="Isca usada" style={{ flex: 1 }} />
          <Input value={form.weight} onChange={v => setForm({...form,weight:v})} placeholder="Peso/tamanho" style={{ width: 100 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 1 }}>{[1,2,3,4,5].map(n => <span key={n} onClick={() => setForm({...form,rating:n})} style={{ cursor: "pointer", fontSize: 16, color: n<=form.rating ? theme.amber : theme.textDim }}>★</span>)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input value={form.notes} onChange={v => setForm({...form,notes:v})} placeholder="Observações, técnicas, aprendizados..." style={{ flex: 1 }} />
          <Btn onClick={add} variant="primary">{Icons.plus} Registrar</Btn>
        </div>
      </div>
      {fishing.sort((a,b) => b.date?.localeCompare(a.date)).map(f => (
        <div key={f.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{f.location}</span>
              <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 8 }}>{f.date}</span>
              <span style={{ color: theme.amber, marginLeft: 8 }}>{"★".repeat(f.rating||0)}</span>
            </div>
            <span onClick={() => del(f.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {f.species && <Badge color="green">{f.species}</Badge>}
            {f.bait && <Badge color="amber">{f.bait}</Badge>}
            {f.weight && <Badge>{f.weight}</Badge>}
            {f.conditions && <span style={{ fontSize: 11, color: theme.textDim }}>{f.conditions}</span>}
          </div>
          {f.notes && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6, fontStyle: "italic" }}>{f.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Aquarium ───
function AquariumView({ aquarium, setAquarium }) {
  const [tab, setTab] = useState("params");
  const params = aquarium.filter(a => a.type === "param").sort((a,b) => b.date?.localeCompare(a.date));
  const maintenance = aquarium.filter(a => a.type === "maint").sort((a,b) => b.date?.localeCompare(a.date));
  const inventory = aquarium.filter(a => a.type === "fish");

  const [pForm, setPForm] = useState({ date: fmtDate(new Date()), ph: "", ammonia: "", nitrite: "", nitrate: "", temp: "" });
  const [mForm, setMForm] = useState({ date: fmtDate(new Date()), task: "", notes: "" });
  const [fForm, setFForm] = useState({ name: "", qty: 1, notes: "" });

  const addParam = () => { setAquarium(p => [...p, { ...pForm, id: Date.now(), type: "param" }]); setPForm({ ...pForm, ph: "", ammonia: "", nitrite: "", nitrate: "", temp: "" }); };
  const addMaint = () => { if (!mForm.task.trim()) return; setAquarium(p => [...p, { ...mForm, id: Date.now(), type: "maint" }]); setMForm({ ...mForm, task: "", notes: "" }); };
  const addFish = () => { if (!fForm.name.trim()) return; setAquarium(p => [...p, { ...fForm, id: Date.now(), type: "fish" }]); setFForm({ name: "", qty: 1, notes: "" }); };
  const del = id => setAquarium(p => p.filter(x => x.id !== id));

  const lastP = params[0] || {};
  const prevP = params[1] || {};
  const trend = (cur, prev) => { if (!cur || !prev) return ""; const c = parseFloat(cur), p = parseFloat(prev); if (isNaN(c) || isNaN(p)) return ""; return c > p ? "↑" : c < p ? "↓" : "→"; };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 12 }}>Aquário</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["params","Parâmetros"],["maint","Manutenção"],["fish","Inventário"]].map(([k,l]) => <Btn key={k} small variant={tab===k?"primary":"default"} onClick={() => setTab(k)}>{l}</Btn>)}
      </div>

      {tab === "params" && <>
        {/* Current params cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
          {[["pH",lastP.ph,"6.5-7.5"],["Amônia",lastP.ammonia,"0 ppm"],["Nitrito",lastP.nitrite,"0 ppm"],["Nitrato",lastP.nitrate,"<40 ppm"],["Temp",lastP.temp,"24-26°C"]].map(([label,val,ideal],i) => {
            const keys = ["ph","ammonia","nitrite","nitrate","temp"];
            const tr = trend(val, prevP[keys[i]]);
            return (
              <div key={i} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 10, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: theme.textDim, fontFamily: theme.font, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: val ? theme.text : theme.textDim, fontFamily: theme.font }}>{val || "-"} <span style={{ fontSize: 12, color: tr === "↑" ? theme.red : tr === "↓" ? theme.green : theme.textDim }}>{tr}</span></div>
                <div style={{ fontSize: 8, color: theme.textDim }}>Ideal: {ideal}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Input type="date" value={pForm.date} onChange={v => setPForm({...pForm,date:v})} style={{ width: 130 }} />
            <Input value={pForm.ph} onChange={v => setPForm({...pForm,ph:v})} placeholder="pH" style={{ width: 65 }} />
            <Input value={pForm.ammonia} onChange={v => setPForm({...pForm,ammonia:v})} placeholder="NH3" style={{ width: 65 }} />
            <Input value={pForm.nitrite} onChange={v => setPForm({...pForm,nitrite:v})} placeholder="NO2" style={{ width: 65 }} />
            <Input value={pForm.nitrate} onChange={v => setPForm({...pForm,nitrate:v})} placeholder="NO3" style={{ width: 65 }} />
            <Input value={pForm.temp} onChange={v => setPForm({...pForm,temp:v})} placeholder="°C" style={{ width: 55 }} />
            <Btn small onClick={addParam} variant="primary">{Icons.plus}</Btn>
          </div>
        </div>
        {params.slice(0, 8).map(p => (
          <div key={p.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 12, alignItems: "center" }}>
            <span style={{ color: theme.textMuted, fontFamily: theme.font, width: 80 }}>{p.date}</span>
            <span style={{ color: theme.text }}>pH:{p.ph}</span>
            <span style={{ color: theme.text }}>NH3:{p.ammonia}</span>
            <span style={{ color: theme.text }}>NO2:{p.nitrite}</span>
            <span style={{ color: theme.text }}>NO3:{p.nitrate}</span>
            <span style={{ color: theme.text }}>{p.temp}°C</span>
            <span onClick={() => del(p.id)} style={{ cursor: "pointer", color: theme.textDim, marginLeft: "auto" }}>{Icons.trash}</span>
          </div>
        ))}
      </>}

      {tab === "maint" && <>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input type="date" value={mForm.date} onChange={v => setMForm({...mForm,date:v})} style={{ width: 140 }} />
            <select value={mForm.task} onChange={e => setMForm({...mForm,task:e.target.value})} style={{ background: theme.bgInput, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "0 10px", fontSize: 12, flex: 1 }}>
              <option value="">Tipo de manutenção</option>
              {["TPA (troca parcial)","Limpeza filtro","Poda plantas","Dosagem fertilizante","Troca mídia","Limpeza vidro","Troca lâmpada","Sifonagem","Outro"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input value={mForm.notes} onChange={v => setMForm({...mForm,notes:v})} placeholder="Obs." style={{ flex: 1 }} />
            <Btn small onClick={addMaint} variant="primary">{Icons.plus}</Btn>
          </div>
        </div>
        {maintenance.map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
            <span style={{ fontFamily: theme.font, color: theme.textDim, width: 80 }}>{m.date}</span>
            <Badge color="green">{m.task}</Badge>
            <span style={{ color: theme.textMuted, flex: 1 }}>{m.notes}</span>
            <span onClick={() => del(m.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
          </div>
        ))}
        {maintenance.length === 0 && <p style={{ color: theme.textDim, fontSize: 13, padding: 16, textAlign: "center" }}>Nenhuma manutenção registrada</p>}
      </>}

      {tab === "fish" && <>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={fForm.name} onChange={v => setFForm({...fForm,name:v})} placeholder="Espécie / Planta" style={{ flex: 1 }} />
            <Input value={fForm.qty} onChange={v => setFForm({...fForm,qty:parseInt(v)||1})} placeholder="Qtd" type="number" style={{ width: 60 }} />
            <Input value={fForm.notes} onChange={v => setFForm({...fForm,notes:v})} placeholder="Obs." style={{ flex: 1 }} />
            <Btn small onClick={addFish} variant="primary">{Icons.plus}</Btn>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {inventory.map(f => (
            <div key={f.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{f.name}</span>
                <span onClick={() => del(f.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>Qtd: {f.qty} {f.notes && `· ${f.notes}`}</div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

// ─── News Clipping ───
function NewsView({ news, setNews }) {
  const [form, setForm] = useState({ title: "", url: "", tag: "", notes: "" });
  const [briefing, setBriefing] = useState("");
  const [loadingBrief, setLoadingBrief] = useState(false);
  const tags = [...new Set(news.map(n => n.tag).filter(Boolean))];

  const add = () => { if (!form.title.trim()) return; setNews(p => [...p, { ...form, id: Date.now(), date: fmtDate(new Date()) }]); setForm({ title: "", url: "", tag: form.tag, notes: "" }); };
  const del = id => setNews(p => p.filter(x => x.id !== id));

  const getBriefing = async () => {
    setLoadingBrief(true);
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: "Faça um briefing rápido de hoje para um empresário brasileiro que atua com importação da China, produtos de saúde, e BI/tecnologia. Inclua: cotação do dólar e yuan, principais notícias de comércio exterior, e uma notícia de tecnologia. Seja breve e direto, máximo 8 linhas." }] }) });
      const data = await res.json();
      setBriefing(data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "Sem briefing disponível");
    } catch { setBriefing("Erro ao buscar briefing"); }
    setLoadingBrief(false);
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Notícias & Clipping</h2>
        <Btn onClick={getBriefing} variant="primary" disabled={loadingBrief}>{loadingBrief ? "Buscando..." : "Briefing do Dia (IA)"}</Btn>
      </div>
      {briefing && <div style={{ background: theme.accentBg, border: `1px solid ${theme.accent}`, borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13, color: theme.text, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{briefing}</div>}
      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input value={form.title} onChange={v => setForm({...form,title:v})} placeholder="Título / Manchete" style={{ flex: 2, minWidth: 160 }} />
          <Input value={form.url} onChange={v => setForm({...form,url:v})} placeholder="URL (opcional)" style={{ flex: 1, minWidth: 120 }} />
          <Input value={form.tag} onChange={v => setForm({...form,tag:v})} placeholder="Tag" style={{ width: 100 }} />
          <Btn onClick={add} variant="primary">{Icons.plus}</Btn>
        </div>
      </div>
      {tags.length > 0 && <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>{tags.map(t => <Badge key={t}>{t}</Badge>)}</div>}
      {news.sort((a,b) => b.date?.localeCompare(a.date)).map(n => (
        <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>{n.url ? <a href={n.url} target="_blank" rel="noopener" style={{ color: theme.accent, textDecoration: "none" }}>{n.title}</a> : n.title}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
              <span style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font }}>{n.date}</span>
              {n.tag && <Badge>{n.tag}</Badge>}
            </div>
          </div>
          <span onClick={() => del(n.id)} style={{ cursor: "pointer", color: theme.textDim }}>{Icons.trash}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main App (continued) ───
export default function PlannerApp() {
  const [page, setPage] = useState("home");
  const [date, setDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [kanban, setKanban] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [habits, setHabits] = useState([]);
  const [finance, setFinance] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [health, setHealth] = useState([]);
  const [goals, setGoals] = useState([]);
  const [gaita, setGaita] = useState([]);
  const [films, setFilms] = useState([]);
  const [books, setBooks] = useState([]);
  const [fishing, setFishing] = useState([]);
  const [aquarium, setAquarium] = useState([]);
  const [newsClips, setNewsClips] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cities, setCities] = useState([
    { name: "Araraquara", tz: "America/Sao_Paulo", auto: true },
    { name: "Xangai", tz: "Asia/Shanghai", auto: false },
  ]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [globalSelectedEvent, setGlobalSelectedEvent] = useState(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  // Load ALL from storage
  useEffect(() => {
    (async () => {
      const keys = ["tasks","notes","projects","kanban","purchases","meetings","matrix","habits","finance","ideas","health","goals","gaita","films","books","fishing","aquarium","newsClips","accounts","cities"];
      const setters = [setTasks,setNotes,setProjects,setKanban,setPurchases,setMeetings,setMatrix,setHabits,setFinance,setIdeas,setHealth,setGoals,setGaita,setFilms,setBooks,setFishing,setAquarium,setNewsClips,setAccounts,setCities];
      for (let i = 0; i < keys.length; i++) {
        try {
          const d = await store.get(`planner-${keys[i]}`);
          if (d && (Array.isArray(d) ? d.length > 0 : true)) setters[i](d);
        } catch(e) { console.warn(`Failed to load ${keys[i]}:`, e); }
      }
      setLoaded(true);
    })();
  }, []);

  // Save ALL to storage WITH auto-backup
  const safeSave = useCallback(async (key, data) => {
    if (!loaded) return;
    // Before overwriting, save backup of current data
    try {
      const current = await store.get(`planner-${key}`);
      if (current && (Array.isArray(current) ? current.length > 0 : true)) {
        await store.set(`planner-${key}-backup`, current);
      }
    } catch {}
    await store.set(`planner-${key}`, data);
  }, [loaded]);

  useEffect(() => { safeSave("tasks", tasks); }, [tasks, loaded]);
  useEffect(() => { safeSave("notes", notes); }, [notes, loaded]);
  useEffect(() => { safeSave("projects", projects); }, [projects, loaded]);
  useEffect(() => { safeSave("kanban", kanban); }, [kanban, loaded]);
  useEffect(() => { safeSave("purchases", purchases); }, [purchases, loaded]);
  useEffect(() => { safeSave("meetings", meetings); }, [meetings, loaded]);
  useEffect(() => { safeSave("matrix", matrix); }, [matrix, loaded]);
  useEffect(() => { safeSave("habits", habits); }, [habits, loaded]);
  useEffect(() => { safeSave("finance", finance); }, [finance, loaded]);
  useEffect(() => { safeSave("ideas", ideas); }, [ideas, loaded]);
  useEffect(() => { safeSave("health", health); }, [health, loaded]);
  useEffect(() => { safeSave("goals", goals); }, [goals, loaded]);
  useEffect(() => { safeSave("gaita", gaita); }, [gaita, loaded]);
  useEffect(() => { safeSave("films", films); }, [films, loaded]);
  useEffect(() => { safeSave("books", books); }, [books, loaded]);
  useEffect(() => { safeSave("fishing", fishing); }, [fishing, loaded]);
  useEffect(() => { safeSave("aquarium", aquarium); }, [aquarium, loaded]);
  useEffect(() => { safeSave("newsClips", newsClips); }, [newsClips, loaded]);
  useEffect(() => { safeSave("accounts", accounts); }, [accounts, loaded]);
  useEffect(() => { safeSave("cities", cities); }, [cities, loaded]);

  // Recovery tool
  const runRecovery = async () => {
    const keys = ["tasks","notes","projects","kanban","purchases","meetings","matrix","habits","finance","ideas","health","goals","gaita","films","books","fishing","aquarium","newsClips","accounts","cities"];
    const found = {};
    for (const key of keys) {
      try {
        const main = await store.get(`planner-${key}`);
        const backup = await store.get(`planner-${key}-backup`);
        const mainCount = Array.isArray(main) ? main.length : (main ? 1 : 0);
        const backupCount = Array.isArray(backup) ? backup.length : (backup ? 1 : 0);
        found[key] = { main: mainCount, backup: backupCount, hasBackup: backupCount > 0 };
      } catch { found[key] = { main: 0, backup: 0, hasBackup: false }; }
    }
    setRecoveryData(found);
    setShowRecovery(true);
  };

  const restoreFromBackup = async (key) => {
    try {
      const backup = await store.get(`planner-${key}-backup`);
      if (backup) {
        const setters = { tasks:setTasks, notes:setNotes, projects:setProjects, kanban:setKanban, purchases:setPurchases, meetings:setMeetings, matrix:setMatrix, habits:setHabits, finance:setFinance, ideas:setIdeas, health:setHealth, goals:setGoals, gaita:setGaita, films:setFilms, books:setBooks, fishing:setFishing, aquarium:setAquarium, newsClips:setNewsClips, accounts:setAccounts, cities:setCities };
        if (setters[key]) { setters[key](backup); await store.set(`planner-${key}`, backup); }
        runRecovery(); // refresh display
      }
    } catch(e) { console.error("Restore error:", e); }
  };

  const syncEvents = useCallback(async (dateStr) => {
    setSyncing(true);
    setSyncError("");
    try {
      const targetDate = dateStr || fmtDate(date);
      const { results, text, raw } = await fetchEvents(targetDate);
      const parsed = [];

      // Strategy 1: Parse JSON from MCP tool results
      const toolResults = (raw || []).filter(b => b.type === "mcp_tool_result");
      for (const tr of toolResults) {
        const txt = tr.content?.[0]?.text || "";
        try {
          const json = JSON.parse(txt);
          const evList = json.events || json.items || (Array.isArray(json) ? json : []);
          for (const ev of evList) {
            const summary = ev.summary || ev.title || "Sem título";
            const startObj = ev.start || {};
            const endObj = ev.end || {};
            const startDT = startObj.dateTime || startObj.date || "";
            const endDT = endObj.dateTime || endObj.date || "";
            const startTime = startDT.includes("T") ? startDT.split("T")[1]?.slice(0,5) : "";
            const endTime = endDT.includes("T") ? endDT.split("T")[1]?.slice(0,5) : "";
            const hour = startTime ? parseInt(startTime.split(":")[0]) : 8;
            parsed.push({
              id: ev.id || "", title: summary,
              time: startTime && endTime ? `${startTime} - ${endTime}` : startTime || "Dia todo",
              hour, location: ev.location || "", status: ev.status || "confirmed",
              description: ev.description || "", htmlLink: ev.htmlLink || "",
              organizer: ev.organizer?.email || ev.creator?.email || "",
              attendees: (ev.attendees || []).map(a => ({ email: a.email, status: a.responseStatus || "" })),
              reminders: ev.reminders?.useDefault ? "Padrão" : (ev.reminders?.overrides || []).map(r => `${r.minutes} min (${r.method})`).join(", ") || "",
              recurrence: ev.recurringEventId ? "Evento recorrente" : (ev.recurrence ? ev.recurrence.join(", ") : ""),
            });
          }
        } catch { /* not JSON */ }
      }

      // Strategy 2: Parse text response
      if (parsed.length === 0 && text) {
        const lines = text.split("\n").filter(l => l.trim());
        for (const line of lines) {
          const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
          const hasSummary = line.match(/[""]([^""]+)[""]/) || line.match(/:\s*(.+)/);
          if (timeMatch && hasSummary) {
            parsed.push({ id: "", title: (hasSummary[1] || line).trim().slice(0, 60), time: `${pad(parseInt(timeMatch[1]))}:${timeMatch[2]}`, hour: parseInt(timeMatch[1]), location: "", status: "" });
          }
        }
      }

      // Strategy 3: Regex on raw results
      if (parsed.length === 0 && results) {
        const summaryMatches = results.match(/"summary"\s*:\s*"([^"]+)"/g) || [];
        for (const sm of summaryMatches) {
          const title = sm.match(/"summary"\s*:\s*"([^"]+)"/)?.[1] || "";
          if (title && !title.includes("@")) parsed.push({ id: "", title, time: "", hour: 9, location: "", status: "" });
        }
      }

      if (parsed.length > 0) {
        setEvents(parsed);
      } else {
        setSyncError("Nenhum evento encontrado para " + targetDate);
      }
    } catch(e) {
      console.error("Sync error:", e);
      setSyncError("Erro ao sincronizar: " + (e.message || "tente novamente"));
      setEvents([]);
    }
    setSyncing(false);
  }, [date]);

  const nav = [
    { id: "_plan", label: "PLANEJAMENTO", section: true },
    { id: "home", label: "Dashboard", icon: Icons.home },
    { id: "annual", label: "Anual", icon: Icons.calendar },
    { id: "monthly", label: "Mensal", icon: Icons.calendar },
    { id: "weekly", label: "Semanal", icon: Icons.week },
    { id: "daily", label: "Diário", icon: Icons.day },
    { id: "tasks", label: "Tarefas", icon: Icons.check },
    { id: "eisenhower", label: "Eisenhower", icon: Icons.week },
    { id: "_work", label: "TRABALHO", section: true },
    { id: "projects", label: "Projetos", icon: Icons.note },
    { id: "kanban", label: "Kanban", icon: Icons.week },
    { id: "purchases", label: "Compras", icon: Icons.note },
    { id: "meetings", label: "Reuniões", icon: Icons.calendar },
    { id: "_personal", label: "PESSOAL", section: true },
    { id: "habits", label: "Hábitos", icon: Icons.check },
    { id: "finance", label: "Financeiro", icon: Icons.note },
    { id: "health", label: "Saúde", icon: Icons.day },
    { id: "gaita", label: "Gaita", icon: Icons.day },
    { id: "_life", label: "VIDA & HOBBIES", section: true },
    { id: "films", label: "Filmes", icon: Icons.note },
    { id: "books", label: "Livros", icon: Icons.note },
    { id: "fishing", label: "Pescaria", icon: Icons.calendar },
    { id: "aquarium", label: "Aquário", icon: Icons.day },
    { id: "news", label: "Notícias", icon: Icons.note },
    { id: "_other", label: "IDEIAS", section: true },
    { id: "brainstorm", label: "Brainstorm", icon: Icons.note },
    { id: "notes", label: "Notas", icon: Icons.note },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, fontFamily: theme.fontSans, color: theme.text }}>
      <style>{css}</style>

      {/* Sidebar */}
      <div style={{ width: 220, background: theme.bgCard, borderRight: `1px solid ${theme.border}`, padding: "20px 12px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 28, padding: "0 8px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: theme.font, color: theme.accent }}>MB LifeOS</div>
          <div style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.font }}>MB Analytics</div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "auto", flex: 1 }}>
          {nav.map(n => n.section ? (
            <div key={n.id} style={{ fontSize: 10, fontWeight: 600, color: theme.textDim, letterSpacing: 1.2, padding: "12px 12px 4px", fontFamily: theme.font }}>{n.label}</div>
          ) : (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "none", background: page === n.id ? theme.accentBg : "transparent", color: page === n.id ? theme.accent : theme.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: theme.fontSans, transition: "all 0.15s", textAlign: "left" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", padding: "12px 8px", borderTop: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <Btn small onClick={() => syncEvents(fmtDate(date))} variant="default" disabled={syncing} style={{ width: "100%", justifyContent: "center" }}>
            <span className={syncing ? "loading" : ""}>{Icons.sync}</span> {syncing ? "Sincronizando..." : "Sync Calendar"}
          </Btn>
          {syncError && <div style={{ fontSize: 10, color: theme.red, padding: "4px 8px", background: theme.redBg, borderRadius: 4, textAlign: "center" }}>{syncError}</div>}
          {syncError && <Btn small variant="ghost" onClick={() => sendPrompt(`Sincronizar eventos do Google Calendar para ${fmtDate(date)}. Retorne o JSON.`)} style={{ width: "100%", justifyContent: "center", fontSize: 9, color: theme.amber }}>Sync via chat</Btn>}
          {events.length > 0 && !syncError && <div style={{ fontSize: 9, color: theme.green, textAlign: "center" }}>{events.length} eventos</div>}
          <Btn small variant="ghost" onClick={runRecovery} style={{ width: "100%", justifyContent: "center", fontSize: 9, color: theme.textDim }}>Recuperar dados</Btn>
          <div style={{ display: "flex", gap: 4 }}>
            <Btn small variant="primary" style={{ flex: 1, justifyContent: "center", fontSize: 10 }} onClick={() => setShowExport(true)}>Exportar</Btn>
            <label style={{ flex: 1, cursor: "pointer", display: "flex" }}>
              <input type="file" accept=".json" style={{ display: "none" }} onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try {
                  const text = await file.text(); const data = JSON.parse(text);
                  if (data.tasks) setTasks(data.tasks);
                  if (data.notes) setNotes(data.notes);
                  if (data.projects) setProjects(data.projects);
                  if (data.kanban) setKanban(data.kanban);
                  if (data.purchases) setPurchases(data.purchases);
                  if (data.meetings) setMeetings(data.meetings);
                  if (data.matrix) setMatrix(data.matrix);
                  if (data.habits) setHabits(data.habits);
                  if (data.finance) setFinance(data.finance);
                  if (data.ideas) setIdeas(data.ideas);
                  if (data.health) setHealth(data.health);
                  if (data.goals) setGoals(data.goals);
                  if (data.gaita) setGaita(data.gaita);
                  if (data.films) setFilms(data.films);
                  if (data.books) setBooks(data.books);
                  if (data.fishing) setFishing(data.fishing);
                  if (data.aquarium) setAquarium(data.aquarium);
                  if (data.newsClips) setNewsClips(data.newsClips);
                  if (data.accounts) setAccounts(data.accounts);
                  if (data.cities) setCities(data.cities);
                  setPage("home");
                } catch (err) { console.error("Import error:", err); }
                e.target.value = "";
              }} />
              <Btn small variant="ghost" style={{ width: "100%", justifyContent: "center", fontSize: 10, pointerEvents: "none" }}>Importar</Btn>
            </label>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "24px 28px", overflow: "auto", maxHeight: "100vh" }}>
        {page === "home" && <Dashboard tasks={tasks} events={events} goTo={setPage} currentDate={date} onSelectEvent={setGlobalSelectedEvent} goals={goals} gaita={gaita} habits={habits} health={health} films={films} books={books} fishing={fishing} aquarium={aquarium} cities={cities} setCities={setCities} />}
        {page === "annual" && <AnnualPlanner date={date} setDate={d => { setDate(d); setPage("monthly"); }} goals={goals} setGoals={setGoals} tasks={tasks} />}
        {page === "daily" && <DailyPlanner date={date} setDate={setDate} tasks={tasks} setTasks={setTasks} events={events} setEvents={setEvents} syncEvents={syncEvents} syncing={syncing} syncError={syncError} />}
        {page === "weekly" && <WeeklyPlanner date={date} setDate={d => { setDate(d); setPage("daily"); }} tasks={tasks} events={events} />}
        {page === "monthly" && <MonthlyPlanner date={date} setDate={d => { setDate(d); setPage("daily"); }} tasks={tasks} goals={goals} setGoals={setGoals} />}
        {page === "tasks" && <TasksView tasks={tasks} setTasks={setTasks} />}
        {page === "eisenhower" && <EisenhowerView matrix={matrix} setMatrix={setMatrix} />}
        {page === "projects" && <ProjectsView projects={projects} setProjects={setProjects} />}
        {page === "kanban" && <KanbanView kanban={kanban} setKanban={setKanban} />}
        {page === "purchases" && <PurchasesView purchases={purchases} setPurchases={setPurchases} />}
        {page === "meetings" && <MeetingsView meetings={meetings} setMeetings={setMeetings} />}
        {page === "habits" && <HabitsView habits={habits} setHabits={setHabits} />}
        {page === "finance" && <FinanceView finance={finance} setFinance={setFinance} accounts={accounts} setAccounts={setAccounts} />}
        {page === "health" && <HealthView health={health} setHealth={setHealth} />}
        {page === "gaita" && <GaitaView gaita={gaita} setGaita={setGaita} />}
        {page === "films" && <FilmsView films={films} setFilms={setFilms} />}
        {page === "books" && <BooksView books={books} setBooks={setBooks} goals={goals} setGoals={setGoals} />}
        {page === "fishing" && <FishingView fishing={fishing} setFishing={setFishing} />}
        {page === "aquarium" && <AquariumView aquarium={aquarium} setAquarium={setAquarium} />}
        {page === "news" && <NewsView news={newsClips} setNews={setNewsClips} />}
        {page === "brainstorm" && <BrainstormView ideas={ideas} setIdeas={setIdeas} />}
        {page === "notes" && <NotesView notes={notes} setNotes={setNotes} />}
      </div>

      {/* Global Event Detail Panel (from Dashboard) */}
      {globalSelectedEvent && (
        <EventDetailPanel event={globalSelectedEvent} onClose={() => setGlobalSelectedEvent(null)} onDelete={() => { setGlobalSelectedEvent(null); syncEvents(fmtDate(date)); }} dateStr={fmtDate(date)} />
      )}

      {/* Recovery Modal */}
      {showRecovery && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowRecovery(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, width: 500, maxHeight: "80vh", overflow: "auto" }} className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Diagnóstico e Recuperação</h3>
              <button onClick={() => setShowRecovery(false)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer" }}>{Icons.x}</button>
            </div>
            <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>Mostra o que está no storage e permite restaurar backups.</p>
            {recoveryData && Object.entries(recoveryData).map(([key, info]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 12 }}>
                <span style={{ flex: 1, color: theme.text, fontWeight: 500 }}>{key}</span>
                <Badge color={info.main > 0 ? "green" : "red"}>{info.main} itens</Badge>
                {info.hasBackup && (
                  <Btn small variant="ghost" onClick={() => restoreFromBackup(key)} style={{ fontSize: 10, color: theme.amber }}>
                    Restaurar backup ({info.backup})
                  </Btn>
                )}
                {!info.hasBackup && <span style={{ fontSize: 10, color: theme.textDim }}>sem backup</span>}
              </div>
            ))}
            <div style={{ marginTop: 14, padding: 10, background: theme.bgHover, borderRadius: 6 }}>
              <p style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
                A partir de agora, toda vez que um dado é salvo, o sistema guarda uma cópia de backup automática. Se algum módulo perder dados, clique "Restaurar backup" para recuperar a versão anterior.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (() => {
        const allData = { tasks, notes, projects, kanban, purchases, meetings, matrix, habits, finance, ideas, health, goals, gaita, films, books, fishing, aquarium, newsClips, accounts, cities, _exported: new Date().toISOString(), _version: "mb-lifeos-v1" };
        const jsonStr = JSON.stringify(allData, null, 2);
        const counts = { tasks:tasks.length, notes:notes.length, projects:projects.length, kanban:kanban.length, finance:finance.length, habits:habits.length, goals:goals.length, gaita:gaita.length, films:films.length, books:books.length, fishing:fishing.length, aquarium:aquarium.length };
        const total = Object.values(counts).reduce((s,v) => s+v, 0);
        return (
          <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center" }} onClick={() => { setShowExport(false); setExportCopied(false); }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:12,padding:20,width:550,maxHeight:"85vh",display:"flex",flexDirection:"column" }} className="fade-in">
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <h3 style={{ fontSize:16,fontWeight:700,color:theme.text }}>Exportar dados — MB LifeOS</h3>
                <button onClick={() => { setShowExport(false); setExportCopied(false); }} style={{ background:"transparent",border:"none",color:theme.textMuted,cursor:"pointer" }}>{Icons.x}</button>
              </div>
              <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:8 }}>
                {Object.entries(counts).filter(([,v])=>v>0).map(([k,v]) => <Badge key={k} color="accent">{k}: {v}</Badge>)}
              </div>
              <div style={{ fontSize:12,color:theme.textMuted,marginBottom:10 }}>Total: {total} itens | {(jsonStr.length/1024).toFixed(1)} KB</div>
              <div style={{ display:"flex",gap:8,marginBottom:10 }}>
                <Btn variant={exportCopied?"default":"primary"} style={{ flex:1 }} onClick={async () => {
                  try { await navigator.clipboard.writeText(jsonStr); setExportCopied(true); }
                  catch { const ta=document.getElementById("exp-ta"); if(ta){ta.select();document.execCommand("copy");setExportCopied(true);} }
                }}>{exportCopied ? "Copiado!" : "Copiar tudo"}</Btn>
                <Btn variant="default" style={{ flex:1 }} onClick={() => { sendPrompt("Backup MB LifeOS:\n```json\n" + jsonStr.slice(0,45000) + "\n```"); setShowExport(false); }}>Enviar pro chat</Btn>
              </div>
              {exportCopied && <div style={{ background:theme.greenBg,border:`1px solid ${theme.green}`,borderRadius:6,padding:10,marginBottom:10,fontSize:12,color:theme.green }}>Copiado! Cole num arquivo .json ou envie pra si mesmo.</div>}
              <textarea id="exp-ta" value={jsonStr} readOnly style={{ flex:1,minHeight:200,width:"100%",background:theme.bg,color:theme.text,border:`1px solid ${theme.border}`,borderRadius:6,padding:10,fontSize:10,fontFamily:theme.font,resize:"none",outline:"none" }} onFocus={e=>e.target.select()} />
              <div style={{ fontSize:10,color:theme.textDim,marginTop:8,lineHeight:1.5 }}>
                1. "Copiar tudo" → cole num arquivo .json<br/>
                2. "Enviar pro chat" → salva na conversa<br/>
                3. Clique no texto, Ctrl+A, Ctrl+C → copia manual
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
