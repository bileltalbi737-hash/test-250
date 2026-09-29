/* =====================================================================
   Carnet — application (aucune dépendance, tout en local)
   ===================================================================== */
'use strict';

/* ===================== Utilitaires ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const nowISO = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, '0');
const clone = (o) => JSON.parse(JSON.stringify(o));
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function dayDiff(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / 864e5); }
function toDateInput(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function toTimeInput(d) { d = new Date(d); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromInputs(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const x = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  return isNaN(x) ? null : x;
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function plural(n, s, p) { return `${n} ${n > 1 ? (p || s + 's') : s}`; }
function icon(name, cls = '') { return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
const fmt = {
  long: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  short: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }),
  shortY: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
  time: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  weekday: new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }),
  dayMonth: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }),
  full: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }),
};

/* ===================== Constantes ===================== */
const COLORS = [
  { id: 'nymphea', name: 'Nymphéa', hex: '#8f86d8' },
  { id: 'renoir', name: 'Rose Renoir', hex: '#ec9fb8' },
  { id: 'coquelicot', name: 'Coquelicot', hex: '#e57b6a' },
  { id: 'peche', name: 'Pêche', hex: '#f5b87e' },
  { id: 'ble', name: 'Blé doré', hex: '#e2bd55' },
  { id: 'saule', name: 'Saule', hex: '#9bc9a1' },
  { id: 'morisot', name: 'Vert Morisot', hex: '#6fb5a8' },
  { id: 'giverny', name: 'Ciel de Giverny', hex: '#86c1e6' },
  { id: 'lilas', name: 'Lilas', hex: '#c69be0' },
  { id: 'fusain', name: 'Fusain', hex: '#9a97a8' },
];
const colorHex = (id) => (COLORS.find((c) => c.id === id) || COLORS[9]).hex;
const colorName = (id) => (COLORS.find((c) => c.id === id) || {}).name || '';

// Identifiants fixes : deux appareils qui démarrent séparément créent les MÊMES listes,
// donc la première synchronisation les fusionne au lieu de les dupliquer.
const DEFAULT_LISTS = [
  { id: 'inbox', name: 'Boîte de réception', emoji: '📥', color: 'fusain', system: true },
  { id: 'l-etudes', name: 'Études', emoji: '📚', color: 'nymphea' },
  { id: 'l-enseignement', name: 'Enseignement', emoji: '🎓', color: 'giverny' },
  { id: 'l-chat', name: 'Chat', emoji: '🐈', color: 'peche' },
  { id: 'l-maison', name: 'Maison', emoji: '🏡', color: 'saule' },
  { id: 'l-perso', name: 'Perso', emoji: '💖', color: 'renoir' },
  { id: 'l-courses', name: 'Courses', emoji: '🛒', color: 'ble' },
];
// Date « ancienne » pour les éléments de départ : toute vraie modification ou suppression
// faite par l'utilisatrice est plus récente et gagne donc lors d'une fusion.
const SEED_TIME = '2020-01-01T00:00:00.000Z';

const PRIORITIES = [
  { v: 0, label: 'Aucune' },
  { v: 1, label: 'Basse' },
  { v: 2, label: 'Moyenne' },
  { v: 3, label: 'Haute' },
];
const REPEATS = [
  { v: 'none', label: 'Jamais' },
  { v: 'daily', label: 'Tous les jours' },
  { v: 'weekdays', label: 'En semaine (lun → ven)' },
  { v: 'weekly', label: 'Toutes les semaines' },
  { v: 'biweekly', label: 'Toutes les deux semaines' },
  { v: 'monthly', label: 'Tous les mois' },
  { v: 'yearly', label: 'Tous les ans' },
];
const DOW = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

/* ===================== État & persistance ===================== */
const KEY = 'carnet.v1';
const defaultSettings = () => ({
  name: '',
  theme: 'auto',
  sortBy: 'manual',
  showDone: false,
  onboarded: false,
  notifications: false,
  collapsed: {},
  sync: { enabled: false, url: '', token: '', passphrase: '', lastSyncAt: null, lastRev: 0 },
});
let state = { tasks: [], lists: [], settings: defaultSettings(), meta: { dirty: false, mutations: 0 } };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    const ds = defaultSettings();
    state = {
      tasks: Array.isArray(p.tasks) ? p.tasks : [],
      lists: Array.isArray(p.lists) ? p.lists : [],
      settings: { ...ds, ...(p.settings || {}), sync: { ...ds.sync, ...((p.settings || {}).sync || {}) } },
      meta: { dirty: false, mutations: 0, ...(p.meta || {}) },
    };
  } catch (e) { console.error('Chargement impossible', e); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Impossible d’enregistrer (stockage plein ?)'); }
}
function commit({ render: doRender = true, sync: doSync = true } = {}) {
  save();
  if (doRender) render();
  if (doSync) { state.meta.dirty = true; state.meta.mutations = (state.meta.mutations || 0) + 1; scheduleSync(); }
}
const touch = (item) => { item.updatedAt = nowISO(); };

/* ===================== Accès aux données ===================== */
const activeTasks = () => state.tasks.filter((t) => !t.deleted);
const allLists = () => state.lists.filter((l) => !l.deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const getTask = (id) => state.tasks.find((t) => t.id === id && !t.deleted);
const getList = (id) => state.lists.find((l) => l.id === id && !l.deleted);
const inboxId = () => (getList('inbox') ? 'inbox' : (allLists()[0] || {}).id);
function taskColor(t) { return colorHex(t.color || (getList(t.listId) || {}).color || 'fusain'); }
function minOrder() { return activeTasks().reduce((m, t) => Math.min(m, t.order ?? 0), 0); }
function maxOrder() { return activeTasks().reduce((m, t) => Math.max(m, t.order ?? 0), 0); }

function newTask(data = {}) {
  const t = {
    id: uid(), title: '', notes: '', listId: inboxId(), color: null, tags: [], priority: 0,
    due: null, allDay: true, repeat: null, subtasks: [], done: false, doneAt: null, pinned: false,
    order: minOrder() - 1, createdAt: nowISO(), updatedAt: nowISO(), deleted: false, ...data,
  };
  if (!t.listId || !getList(t.listId)) t.listId = inboxId();
  state.tasks.push(t);
  return t;
}
function updateTask(id, patch, opts) {
  const t = getTask(id); if (!t) return;
  Object.assign(t, patch); touch(t); commit(opts);
}
function deleteTask(id, opts) {
  const t = getTask(id); if (!t) return;
  t.deleted = true; touch(t); commit(opts);
}
function restoreTask(id) {
  const t = state.tasks.find((x) => x.id === id); if (!t) return;
  t.deleted = false; touch(t); commit();
}
function setDone(id, done) {
  const t = getTask(id); if (!t) return null;
  t.done = done; t.doneAt = done ? nowISO() : null; touch(t);
  let spawned = null;
  if (done && t.repeat && t.repeat.type && t.repeat.type !== 'none' && t.due) {
    const next = nextDue(t);
    if (next) {
      spawned = newTask({
        ...clone(t), id: uid(), due: next, done: false, doneAt: null,
        subtasks: (t.subtasks || []).map((s) => ({ ...s, id: uid(), done: false })),
        createdAt: nowISO(), updatedAt: nowISO(), order: t.order, deleted: false,
      });
    }
  }
  commit();
  return spawned;
}
function newList(data = {}) {
  const order = state.lists.reduce((m, l) => Math.max(m, l.order ?? 0), 0) + 1;
  const l = { id: uid(), name: 'Nouvelle liste', emoji: '📝', color: 'nymphea', order, createdAt: nowISO(), updatedAt: nowISO(), deleted: false, ...data };
  state.lists.push(l);
  return l;
}
function deleteList(id) {
  const l = getList(id); if (!l || l.system) return;
  for (const t of activeTasks()) if (t.listId === id) { t.listId = inboxId(); touch(t); }
  l.deleted = true; touch(l); commit();
}

/* ===================== Récurrence ===================== */
function nextDue(task) {
  const r = task.repeat; if (!r || r.type === 'none' || !task.due) return null;
  let d = new Date(task.due); const today = startOfDay(new Date());
  const origDay = d.getDate();
  const step = () => {
    switch (r.type) {
      case 'daily': d = addDays(d, r.interval || 1); break;
      case 'weekdays': do { d = addDays(d, 1); } while (d.getDay() === 0 || d.getDay() === 6); break;
      case 'weekly':
        if (r.days && r.days.length) { do { d = addDays(d, 1); } while (!r.days.includes(d.getDay())); }
        else d = addDays(d, 7 * (r.interval || 1));
        break;
      case 'biweekly': d = addDays(d, 14); break;
      case 'monthly': {
        const m = d.getMonth() + (r.interval || 1);
        const y = d.getFullYear() + Math.floor(m / 12);
        const mm = ((m % 12) + 12) % 12;
        const last = new Date(y, mm + 1, 0).getDate();
        d = new Date(y, mm, Math.min(origDay, last), d.getHours(), d.getMinutes());
        break;
      }
      case 'yearly': d = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()); break;
      default: return;
    }
  };
  step();
  let guard = 0;
  while (startOfDay(d) < today && guard++ < 500) step();
  return d.toISOString();
}
function repeatLabel(r) {
  if (!r || r.type === 'none') return '';
  if (r.type === 'weekly' && r.days && r.days.length) return 'Chaque ' + r.days.map((x) => DOW[x]).join(', ');
  return (REPEATS.find((x) => x.v === r.type) || {}).label || '';
}

/* ===================== Analyse de la saisie rapide (français) ===================== */
function nextDow(dow, forceNext) {
  const today = startOfDay(new Date());
  let ahead = (dow - today.getDay() + 7) % 7;
  if (ahead === 0) ahead = 7;
  if (forceNext && ahead < 7) ahead += 0; // « lundi prochain » = le prochain lundi
  return addDays(today, ahead);
}
function parseQuickAdd(raw, ctx = {}) {
  const out = { title: '', due: null, allDay: true, priority: 0, tags: [], listId: ctx.listId || null, repeat: null, parts: [] };
  let text = ' ' + String(raw || '').replace(/\s+/g, ' ').trim() + ' ';
  const eat = (re, fn) => {
    const m = text.match(re);
    if (!m) return false;
    const r = fn(m);
    if (r !== false) text = text.replace(m[0], ' ');
    return true;
  };

  // #tags
  text = text.replace(/\s#([\p{L}\p{N}_-]{1,30})(?=\s)/gu, (m, t) => { out.tags.push(t.toLowerCase()); return ' '; });
  // @liste
  text = text.replace(/\s@([\p{L}\p{N}_-]{1,30})(?=\s)/gu, (m, name) => {
    const l = allLists().find((x) => norm(x.name).startsWith(norm(name)));
    if (l) { out.listId = l.id; return ' '; }
    return m;
  });
  // !, !!, !!!
  eat(/\s(!{1,3})(?=\s)/, (m) => { out.priority = m[1].length; });
  eat(/\s(urgent|important)(?=\s)/i, () => { out.priority = Math.max(out.priority, 3); });

  // Récurrence
  const today = startOfDay(new Date());
  eat(/\s(tous les jours|chaque jour|quotidien(?:ne)?)(?=\s)/i, () => { out.repeat = { type: 'daily', interval: 1 }; });
  eat(/\s(en semaine|jours ouvr[ée]s)(?=\s)/i, () => { out.repeat = { type: 'weekdays' }; });
  eat(/\s(toutes les semaines|chaque semaine|hebdo(?:madaire)?)(?=\s)/i, () => { out.repeat = { type: 'weekly', interval: 1 }; });
  eat(/\s(toutes les (?:deux|2) semaines)(?=\s)/i, () => { out.repeat = { type: 'biweekly' }; });
  eat(/\s(tous les mois|chaque mois|mensuel(?:le)?)(?=\s)/i, () => { out.repeat = { type: 'monthly', interval: 1 }; });
  eat(/\s(tous les ans|chaque ann[ée]e|annuel(?:le)?)(?=\s)/i, () => { out.repeat = { type: 'yearly', interval: 1 }; });
  eat(/\s(?:tous les|chaque)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?(?=\s)/i, (m) => {
    const dow = DOW.indexOf(norm(m[1]));
    out.repeat = { type: 'weekly', interval: 1, days: [dow] };
    if (!out.due) out.due = nextDow(dow);
  });

  // Dates
  let date = null;
  eat(/\s(aujourd'?hui|auj)(?=\s)/i, () => { date = today; });
  eat(/\s(apr[eè]s[- ]demain)(?=\s)/i, () => { date = addDays(today, 2); });
  eat(/\sdemain(?=\s)/i, () => { date = addDays(today, 1); });
  eat(/\s(?:ce )?week-?end(?=\s)/i, () => { date = nextDow(6); });
  eat(/\s(?:la )?semaine prochaine(?=\s)/i, () => { date = nextDow(1); });
  eat(/\s(?:le )?mois prochain(?=\s)/i, () => { const d = new Date(today); d.setMonth(d.getMonth() + 1, 1); date = d; });
  eat(/\sdans (\d{1,3}) jours?(?=\s)/i, (m) => { date = addDays(today, +m[1]); });
  eat(/\sdans (\d{1,2}) semaines?(?=\s)/i, (m) => { date = addDays(today, 7 * +m[1]); });
  eat(/\sdans (\d{1,2}) mois(?=\s)/i, (m) => { const d = new Date(today); d.setMonth(d.getMonth() + +m[1]); date = d; });
  eat(/\s(?:le |ce )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)( prochain)?(?=\s)/i, (m) => { date = nextDow(DOW.indexOf(norm(m[1])), !!m[2]); });
  eat(/\s(?:le )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (m) => {
    let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (isNaN(d)) return false;
    if (!m[3] && d < today) d.setFullYear(d.getFullYear() + 1);
    date = d;
  });
  eat(/\s(?:le )?(\d{1,2})(?:er)? (janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?: (\d{4}))?(?=\s)/i, (m) => {
    const mi = MONTHS.indexOf(norm(m[2]));
    const d = new Date(m[3] ? +m[3] : today.getFullYear(), mi, +m[1]);
    if (!m[3] && d < today) d.setFullYear(d.getFullYear() + 1);
    date = d;
  });
  eat(/\sle (\d{1,2})(?=\s)/, (m) => {
    const d = new Date(today.getFullYear(), today.getMonth(), +m[1]);
    if (d < today) d.setMonth(d.getMonth() + 1);
    if (d.getDate() !== +m[1]) return false;
    date = d;
  });

  // Heures
  let time = null;
  eat(/\s(?:[àa] )?(\d{1,2})\s?h\s?(\d{2})?(?=\s)/i, (m) => { const h = +m[1]; if (h > 23) return false; time = [h, m[2] ? +m[2] : 0]; });
  if (!time) eat(/\s(?:[àa] )?(\d{1,2}):(\d{2})(?=\s)/, (m) => { const h = +m[1]; if (h > 23 || +m[2] > 59) return false; time = [h, +m[2]]; });
  if (!time) eat(/\s(?:[àa] )?midi(?=\s)/i, () => { time = [12, 0]; });
  if (!time) eat(/\s(ce )?soir(?=\s)/i, () => { time = [20, 0]; });
  if (!time) eat(/\s(ce )?matin(?=\s)/i, () => { time = [9, 0]; });
  if (!time) eat(/\s(cet )?apr[eè]s?[- ]?midi(?=\s)/i, () => { time = [14, 0]; });
  if (!time) eat(/\s(ce )?midi(?=\s)/i, () => { time = [12, 0]; });

  if (date || time) {
    const d = date ? new Date(date) : new Date(today);
    if (time) { d.setHours(time[0], time[1], 0, 0); out.allDay = false; }
    else { d.setHours(0, 0, 0, 0); out.allDay = true; }
    out.due = d.toISOString();
  }
  out.title = text.replace(/\s+/g, ' ').trim();
  if (!out.title) out.title = String(raw || '').trim();
  return out;
}

/* ===================== Étiquettes de dates ===================== */
function dueInfo(t) {
  if (!t.due) return null;
  const d = new Date(t.due); const now = new Date();
  const diff = dayDiff(d, now);
  let label;
  if (diff === 0) label = 'Aujourd’hui';
  else if (diff === 1) label = 'Demain';
  else if (diff === -1) label = 'Hier';
  else if (diff > 1 && diff < 7) label = cap(fmt.weekday.format(d));
  else if (d.getFullYear() === now.getFullYear()) label = fmt.short.format(d);
  else label = fmt.shortY.format(d);
  if (!t.allDay) label += ' · ' + fmt.time.format(d);
  const late = !t.done && (t.allDay ? diff < 0 : d < now);
  return { label, late, today: diff === 0, diff };
}

/* ===================== Vue courante & tri ===================== */
let view = { type: 'today', id: null };
const VIEW_TYPES = ['today', 'upcoming', 'all', 'done', 'search'];
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [type, id] = h.split('/');
  if (VIEW_TYPES.includes(type)) return { type, id: null };
  if (type === 'list' && id && getList(id)) return { type, id };
  return { type: 'today', id: null };
}
function go(type, id) { const h = id ? `#${type}/${id}` : `#${type}`; if (location.hash === h) { render(); } else location.hash = h; }

function sortTasks(arr) {
  const by = state.settings.sortBy;
  const dueVal = (t) => (t.due ? new Date(t.due).getTime() : Infinity);
  const cmps = {
    manual: (a, b) => (a.order ?? 0) - (b.order ?? 0),
    due: (a, b) => dueVal(a) - dueVal(b) || (a.order ?? 0) - (b.order ?? 0),
    priority: (a, b) => (b.priority || 0) - (a.priority || 0) || dueVal(a) - dueVal(b) || (a.order ?? 0) - (b.order ?? 0),
    alpha: (a, b) => a.title.localeCompare(b.title, 'fr'),
    created: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
  };
  const cmp = cmps[by] || cmps.manual;
  return [...arr].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || cmp(a, b));
}

/* ===================== Rendu ===================== */
function render() {
  renderSidebar();
  renderView();
  updateBadge();
}

function counts() {
  const now = new Date(); const tasks = activeTasks();
  const open = tasks.filter((t) => !t.done);
  const late = open.filter((t) => { const i = dueInfo(t); return i && i.late; });
  const todayT = open.filter((t) => { const i = dueInfo(t); return i && i.today && !i.late; });
  const pinned = open.filter((t) => t.pinned);
  const upcoming = open.filter((t) => t.due && dayDiff(new Date(t.due), now) > 0);
  const done = tasks.filter((t) => t.done);
  return { open, late, todayT, pinned, upcoming, done };
}

function renderSidebar() {
  const c = counts();
  const smart = [
    { type: 'today', name: 'Aujourd’hui', icon: 'today', n: c.late.length + c.todayT.length },
    { type: 'upcoming', name: 'À venir', icon: 'upcoming', n: c.upcoming.length },
    { type: 'all', name: 'Toutes', icon: 'all', n: c.open.length },
    { type: 'done', name: 'Terminées', icon: 'done', n: c.done.length },
  ];
  $('#nav-smart').innerHTML = smart.map((s) => `
    <button class="nav-item ${view.type === s.type ? 'active' : ''}" data-go="${s.type}">
      ${icon(s.icon)}<span class="nm">${s.name}</span><span class="ct">${s.n || ''}</span>
    </button>`).join('');
  $('#nav-lists').innerHTML = allLists().map((l) => {
    const n = c.open.filter((t) => t.listId === l.id).length;
    return `<button class="nav-item ${view.type === 'list' && view.id === l.id ? 'active' : ''}" data-go="list" data-id="${l.id}">
      <span class="emoji">${esc(l.emoji || '•')}</span><span class="nm">${esc(l.name)}</span><span class="dab" style="--c:${colorHex(l.color)}"></span><span class="ct">${n || ''}</span>
    </button>`;
  }).join('');
  const name = state.settings.name;
  $('#brand-sub').textContent = name ? `le carnet de ${name}` : 'petit carnet impressionniste';
}

function setTitle(title, sub = '') {
  $('#view-title').textContent = title;
  $('#view-sub').textContent = sub;
}

function groupHTML(key, title, tasks, { color, late, collapsible = true, note, extra = '' } = {}) {
  if (!tasks.length) return '';
  const collapsed = !!state.settings.collapsed[key];
  return `<section class="group" data-group="${esc(key)}">
    <div class="group-head ${late ? 'late' : ''}" style="--gc:${color || 'var(--accent)'}">
      <span class="stroke">${esc(title)}</span><span class="n">${tasks.length}</span>
      ${note ? `<span class="n">${esc(note)}</span>` : ''}
      ${extra}
      ${collapsible ? `<button class="toggle" data-collapse="${esc(key)}">${collapsed ? 'Afficher' : 'Masquer'}</button>` : ''}
    </div>
    ${collapsed ? '' : tasks.map((t) => taskRow(t)).join('')}
  </section>`;
}

function taskRow(t) {
  const c = taskColor(t); const due = dueInfo(t); const list = getList(t.listId);
  const subs = t.subtasks || []; const subDone = subs.filter((s) => s.done).length;
  const meta = [];
  if (due) meta.push(`<span class="due ${due.late ? 'late' : due.today ? 'today' : ''}">${icon(t.allDay ? 'calendar' : 'clock')}${esc(due.label)}</span>`);
  if (t.priority) meta.push(`<span class="prio prio-${t.priority}">${icon('flag')}${PRIORITIES[t.priority].label}</span>`);
  if (t.repeat && t.repeat.type !== 'none') meta.push(`<span title="${esc(repeatLabel(t.repeat))}">${icon('repeat')}</span>`);
  if (subs.length) meta.push(`<span class="sub ${subDone === subs.length ? 'all' : ''}">${icon('done')}${subDone}/${subs.length}</span>`);
  if (list && !(view.type === 'list' && view.id === list.id)) meta.push(`<span class="list">${esc(list.emoji || '')} ${esc(list.name)}</span>`);
  for (const tag of t.tags || []) meta.push(`<span class="tag" data-tag="${esc(tag)}">#${esc(tag)}</span>`);
  const showSubs = subs.length && !t.done;
  const firstLine = (t.notes || '').split('\n').find((l) => l.trim()) || '';
  return `<div class="task ${t.done ? 'done' : ''}" data-id="${t.id}" style="--c:${c}">
    <div class="task-bg"><span class="l">${icon('check')} ${t.done ? 'À refaire' : 'Terminer'}</span><span class="r">Supprimer ${icon('trash')}</span></div>
    <div class="task-inner">
      <button class="task-check" aria-label="${t.done ? 'Marquer à faire' : 'Terminer'}">${icon('check')}</button>
      <div class="task-body">
        <div class="title">${t.pinned ? icon('pin', 'pin') : ''}${esc(t.title) || '<i>Sans titre</i>'}</div>
        ${firstLine ? `<div class="notes">${esc(firstLine)}</div>` : ''}
        ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
        ${showSubs ? `<div class="sub-preview">${subs.slice(0, 4).map((s) => `<div class="${s.done ? 'ok' : ''}" data-sid="${s.id}"><i></i>${esc(s.title)}</div>`).join('')}${subs.length > 4 ? `<div>… et ${subs.length - 4} autres</div>` : ''}</div>` : ''}
      </div>
      ${state.settings.sortBy === 'manual' && !t.done ? `<div class="handle" title="Glisser pour réordonner">${icon('drag')}</div>` : ''}
    </div>
  </div>`;
}

function emptyHTML(title, text) {
  return `<div class="empty"><div class="art"><span></span><span></span><span></span></div><h3>${title}</h3><p>${text}</p></div>`;
}

const SEARCH = { q: '', listId: null, priority: null, tag: null, status: 'open' };

function renderView() {
  const content = $('#content');
  const c = counts();
  const name = state.settings.name;
  let html = '';

  if (view.type === 'today') {
    const hour = new Date().getHours();
    const hello = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bel après-midi' : 'Bonsoir';
    setTitle('Aujourd’hui', cap(fmt.long.format(new Date())));
    const doneToday = c.done.filter((t) => t.doneAt && dayDiff(new Date(t.doneAt), new Date()) === 0);
    const pinnedOnly = c.pinned.filter((t) => !c.late.includes(t) && !c.todayT.includes(t));
    const summary = [];
    if (c.late.length) summary.push(`<span class="pill late"><b>${c.late.length}</b> en retard</span>`);
    summary.push(`<span class="pill"><b>${c.todayT.length}</b> aujourd’hui</span>`);
    if (doneToday.length) summary.push(`<span class="pill"><b>${doneToday.length}</b> terminée${doneToday.length > 1 ? 's' : ''} ✓</span>`);
    html += `<div class="hero">
      <div class="hello">${hello}${name ? `, <em>${esc(name)}</em>` : ''} <span aria-hidden="true">✨</span></div>
      <div class="date">${cap(fmt.long.format(new Date()))}</div>
      <div class="summary">${summary.join('')}</div>
    </div>`;
    html += groupHTML('late', 'En retard', sortTasks(c.late), { late: true, color: 'var(--danger)' });
    html += groupHTML('today', 'Aujourd’hui', sortTasks(c.todayT), { color: 'var(--accent)' });
    html += groupHTML('pinned', 'Épinglées', sortTasks(pinnedOnly), { color: 'var(--ble)' });
    html += groupHTML('doneToday', 'Terminées aujourd’hui', doneToday.sort((a, b) => b.doneAt.localeCompare(a.doneAt)), { color: 'var(--ok)' });
    if (!c.late.length && !c.todayT.length && !pinnedOnly.length) {
      html += emptyHTML(doneToday.length ? 'Tout est fait !' : 'Journée libre', doneToday.length ? 'Tu peux poser le pinceau, la toile du jour est finie.' : 'Rien de prévu aujourd’hui. Ajoute une tâche ci-dessous, ou profite. 🌸');
    }
  }

  else if (view.type === 'upcoming') {
    setTitle('À venir', 'les 7 prochains jours et après');
    const now = new Date();
    const open = c.open.filter((t) => t.due);
    html += groupHTML('late', 'En retard', sortTasks(c.late), { late: true, color: 'var(--danger)' });
    for (let i = 0; i < 7; i++) {
      const day = addDays(now, i);
      const ts = open.filter((t) => dayDiff(new Date(t.due), now) === i && !(i === 0 && dueInfo(t).late));
      const title = i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : cap(fmt.weekday.format(day));
      html += groupHTML('d' + i, title, sortTasks(ts).sort((a, b) => (a.allDay ? 1 : 0) - (b.allDay ? 1 : 0) || new Date(a.due) - new Date(b.due)), { note: fmt.dayMonth.format(day), color: i === 0 ? 'var(--accent)' : 'var(--giverny)' });
    }
    const later = open.filter((t) => dayDiff(new Date(t.due), now) >= 7).sort((a, b) => new Date(a.due) - new Date(b.due));
    html += groupHTML('later', 'Plus tard', later, { color: 'var(--lilas, #c69be0)' });
    if (!c.late.length && !open.length) html += emptyHTML('Horizon dégagé', 'Aucune échéance à venir. Écris « demain 17h » ou « lundi » dans une tâche pour la planifier.');
  }

  else if (view.type === 'all') {
    setTitle('Toutes', plural(c.open.length, 'tâche en cours', 'tâches en cours'));
    html += `<div class="list-cards">${allLists().map((l) => {
      const n = c.open.filter((t) => t.listId === l.id).length;
      return `<button class="list-card" data-go="list" data-id="${l.id}" style="--c:${colorHex(l.color)}"><div class="emoji">${esc(l.emoji || '•')}</div><div class="nm">${esc(l.name)}</div><div class="ct">${n ? plural(n, 'tâche') : 'rien à faire'}</div></button>`;
    }).join('')}</div>`;
    for (const l of allLists()) {
      const ts = sortTasks(c.open.filter((t) => t.listId === l.id));
      html += groupHTML('list-' + l.id, `${l.emoji || ''} ${l.name}`.trim(), ts, { color: colorHex(l.color) });
    }
    if (!c.open.length) html += emptyHTML('Carnet vierge', 'Toutes tes tâches sont faites. Belle journée !');
  }

  else if (view.type === 'list') {
    const l = getList(view.id);
    if (!l) { go('today'); return; }
    const ts = activeTasks().filter((t) => t.listId === l.id);
    const open = sortTasks(ts.filter((t) => !t.done)); const done = ts.filter((t) => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    setTitle(`${l.emoji || ''} ${l.name}`.trim(), open.length ? plural(open.length, 'tâche en cours', 'tâches en cours') : 'rien en cours');
    const pinned = open.filter((t) => t.pinned); const rest = open.filter((t) => !t.pinned);
    html += groupHTML('lp-' + l.id, 'Épinglées', pinned, { color: 'var(--ble)' });
    html += groupHTML('lo-' + l.id, pinned.length ? 'À faire' : 'À faire', rest, { color: colorHex(l.color), collapsible: false });
    if (done.length) {
      html += `<section class="group"><div class="group-head" style="--gc:var(--ok)"><span class="stroke">Terminées</span><span class="n">${done.length}</span>
        <button class="toggle" data-toggle-done>${state.settings.showDone ? 'Masquer' : 'Afficher'}</button></div>
        ${state.settings.showDone ? done.map((t) => taskRow(t)).join('') : ''}</section>`;
    }
    if (!open.length && !done.length) html += emptyHTML('Page blanche', `Ajoute ta première tâche dans « ${esc(l.name)} » ci-dessous.`);
  }

  else if (view.type === 'done') {
    const done = c.done.sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    setTitle('Terminées', plural(done.length, 'tâche accomplie', 'tâches accomplies'));
    const groups = new Map();
    for (const t of done) {
      const d = t.doneAt ? new Date(t.doneAt) : new Date(t.updatedAt);
      const diff = dayDiff(new Date(), d);
      const key = diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Hier' : diff < 7 ? cap(fmt.weekday.format(d)) : diff < 30 ? 'Ce mois-ci' : 'Plus ancien';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    for (const [k, ts] of groups) html += groupHTML('done-' + k, k, ts, { color: 'var(--ok)' });
    if (done.length) html += `<div style="text-align:center;margin:18px 0"><button class="btn ghost sm" data-clear-done>${icon('trash')} Effacer toutes les terminées</button></div>`;
    else html += emptyHTML('Encore rien', 'Les tâches terminées apparaîtront ici, comme des toiles achevées.');
  }

  else if (view.type === 'search') {
    setTitle('Rechercher', '');
    const tags = new Set(); for (const t of activeTasks()) for (const tg of t.tags || []) tags.add(tg);
    html += `<div class="search-bar">${icon('search')}<input id="search-input" class="input" type="search" placeholder="Titre, note, sous-tâche, #tag…" value="${esc(SEARCH.q)}" autocomplete="off"></div>
    <div class="filters">
      ${['open', 'done', 'all'].map((s) => `<button class="opt ${SEARCH.status === s ? 'on' : ''}" data-sf="status" data-v="${s}">${{ open: 'À faire', done: 'Terminées', all: 'Toutes' }[s]}</button>`).join('')}
      ${[3, 2, 1].map((p) => `<button class="opt ${SEARCH.priority === p ? 'on' : ''}" data-sf="priority" data-v="${p}"><span class="prio-${p}">${icon('flag')}</span>${PRIORITIES[p].label}</button>`).join('')}
    </div>
    <div class="filters">
      ${allLists().map((l) => `<button class="opt ${SEARCH.listId === l.id ? 'on' : ''}" data-sf="listId" data-v="${l.id}"><span class="emoji">${esc(l.emoji || '')}</span>${esc(l.name)}</button>`).join('')}
    </div>
    ${tags.size ? `<div class="filters">${[...tags].sort().map((tg) => `<button class="opt ${SEARCH.tag === tg ? 'on' : ''}" data-sf="tag" data-v="${esc(tg)}">#${esc(tg)}</button>`).join('')}</div>` : ''}`;
    const q = norm(SEARCH.q);
    const res = activeTasks().filter((t) => {
      if (SEARCH.status === 'open' && t.done) return false;
      if (SEARCH.status === 'done' && !t.done) return false;
      if (SEARCH.listId && t.listId !== SEARCH.listId) return false;
      if (SEARCH.priority && t.priority !== SEARCH.priority) return false;
      if (SEARCH.tag && !(t.tags || []).includes(SEARCH.tag)) return false;
      if (!q) return true;
      const hay = norm([t.title, t.notes, ...(t.tags || []).map((x) => '#' + x), ...(t.subtasks || []).map((s) => s.title)].join(' '));
      return q.split(' ').every((w) => hay.includes(w));
    });
    html += groupHTML('search', 'Résultats', sortTasks(res), { collapsible: false });
    if (!res.length) html += emptyHTML('Rien trouvé', q || SEARCH.listId || SEARCH.priority || SEARCH.tag ? 'Essaie d’autres mots ou retire un filtre.' : 'Tape un mot, ou filtre par liste, priorité ou étiquette.');
  }

  content.innerHTML = html;
  if (view.type === 'search') { const si = $('#search-input'); if (si && document.activeElement !== si && !SEARCH.q) si.focus(); }
  const qa = $('#qa-input');
  qa.placeholder = view.type === 'list' ? `Ajouter dans « ${getList(view.id)?.name || ''} »…` : 'Ajouter une tâche… ex : Corriger copies demain 17h !!';
}

function updateBadge() {
  const c = counts(); const n = c.late.length + c.todayT.length;
  document.title = n ? `(${n}) Carnet` : 'Carnet';
  try {
    if ('setAppBadge' in navigator) { n ? navigator.setAppBadge(n).catch(() => {}) : navigator.clearAppBadge().catch(() => {}); }
  } catch (_) {}
}

/* ===================== Toasts (avec Annuler) ===================== */
function toast(msg, { action, onAction, ms = 5000 } = {}) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="msg">${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  if (action) $('button', el).addEventListener('click', () => { onAction && onAction(); kill(); });
  root.appendChild(el);
  while (root.children.length > 3) root.firstChild.remove();
  setTimeout(kill, ms);
}

/* ===================== Actions sur les tâches (avec Annuler) ===================== */
function completeWithUndo(id) {
  const t = getTask(id); if (!t) return;
  const wasDone = t.done;
  const spawned = setDone(id, !wasDone);
  if (!wasDone) {
    toast(spawned ? 'Terminée · prochaine occurrence créée 🔁' : 'Tâche terminée ✓', {
      action: 'Annuler',
      onAction: () => { const x = getTask(id); if (x) { x.done = false; x.doneAt = null; touch(x); } if (spawned) { spawned.deleted = true; touch(spawned); } commit(); },
    });
  }
}
function deleteWithUndo(id) {
  const t = getTask(id); if (!t) return;
  deleteTask(id);
  toast('Tâche supprimée', { action: 'Annuler', onAction: () => restoreTask(id) });
}

/* ===================== Gestes : balayage & réordonnancement ===================== */
const SWIPE_THRESHOLD = 96;
let gesture = null;
let suppressClickUntil = 0;

function bindGestures() {
  const content = $('#content');

  content.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.handle');
    if (handle) { startDrag(e, handle.closest('.task')); return; }
    const row = e.target.closest('.task'); if (!row) return;
    if (e.target.closest('.task-check, button, a, input, .tag, [data-sid]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture = { row, id: row.dataset.id, x: e.clientX, y: e.clientY, dx: 0, mode: null, pid: e.pointerId, inner: $('.task-inner', row) };
  });

  content.addEventListener('pointermove', (e) => {
    if (!gesture || e.pointerId !== gesture.pid) return;
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (!gesture.mode) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        gesture.mode = 'swipe';
        try { gesture.row.setPointerCapture(gesture.pid); } catch (_) {}
        gesture.row.classList.add('swiping');
      } else if (Math.abs(dy) > 10) { gesture = null; return; }
      else return;
    }
    if (gesture.mode === 'swipe') {
      e.preventDefault();
      const w = gesture.row.offsetWidth;
      const lim = Math.sign(dx) * Math.min(Math.abs(dx), w * 0.85);
      gesture.dx = lim;
      gesture.inner.style.transform = `translateX(${lim}px)`;
      gesture.row.dataset.swipe = dx > 0 ? 'right' : 'left';
      const past = Math.abs(dx) > SWIPE_THRESHOLD;
      if (past !== gesture.past) { gesture.past = past; gesture.row.classList.toggle('past', past); if (past && navigator.vibrate) navigator.vibrate(8); }
    }
  });

  const endSwipe = (e) => {
    if (!gesture || (e && e.pointerId !== gesture.pid)) return;
    const g = gesture; gesture = null;
    if (g.mode !== 'swipe') return;
    suppressClickUntil = Date.now() + 350;
    g.row.classList.remove('swiping');
    const dir = g.dx > 0 ? 'right' : 'left';
    if (Math.abs(g.dx) > SWIPE_THRESHOLD && e.type !== 'pointercancel') {
      const w = g.row.offsetWidth;
      g.inner.style.transform = `translateX(${dir === 'right' ? w : -w}px)`;
      g.row.style.transition = 'height .22s ease .18s, margin .22s ease .18s, opacity .18s';
      g.row.style.height = g.row.offsetHeight + 'px';
      requestAnimationFrame(() => { g.row.style.height = '0px'; g.row.style.margin = '0'; g.row.style.opacity = '0'; });
      setTimeout(() => { if (dir === 'right') completeWithUndo(g.id); else deleteWithUndo(g.id); }, 260);
    } else {
      g.inner.style.transform = '';
      setTimeout(() => { delete g.row.dataset.swipe; g.row.classList.remove('past'); }, 250);
    }
  };
  content.addEventListener('pointerup', endSwipe);
  content.addEventListener('pointercancel', endSwipe);

  // Clics (délégation)
  content.addEventListener('click', (e) => {
    if (Date.now() < suppressClickUntil) return;
    const collapse = e.target.closest('[data-collapse]');
    if (collapse) { const k = collapse.dataset.collapse; state.settings.collapsed[k] = !state.settings.collapsed[k]; commit({ sync: false }); return; }
    if (e.target.closest('[data-toggle-done]')) { state.settings.showDone = !state.settings.showDone; commit({ sync: false }); return; }
    if (e.target.closest('[data-clear-done]')) { confirmDialog('Effacer toutes les tâches terminées ?', 'Elles disparaîtront du carnet (annulable pendant quelques secondes).').then((ok) => { if (!ok) return; const ids = activeTasks().filter((t) => t.done).map((t) => t.id); for (const id of ids) { const t = getTask(id); t.deleted = true; touch(t); } commit(); toast(`${ids.length} tâches effacées`, { action: 'Annuler', onAction: () => { for (const id of ids) { const t = state.tasks.find((x) => x.id === id); if (t) { t.deleted = false; touch(t); } } commit(); } }); }); return; }
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { go(goBtn.dataset.go, goBtn.dataset.id); return; }
    const sf = e.target.closest('[data-sf]');
    if (sf) { const k = sf.dataset.sf, v = sf.dataset.v; SEARCH[k] = k === 'status' ? v : (String(SEARCH[k]) === v ? null : (k === 'priority' ? +v : v)); render(); return; }
    const tag = e.target.closest('.tag[data-tag]');
    if (tag) { e.stopPropagation(); Object.assign(SEARCH, { q: '', tag: tag.dataset.tag, listId: null, priority: null, status: 'open' }); go('search'); return; }
    const sub = e.target.closest('[data-sid]');
    if (sub) { e.stopPropagation(); const row = sub.closest('.task'); const t = getTask(row.dataset.id); const s = (t.subtasks || []).find((x) => x.id === sub.dataset.sid); if (s) { s.done = !s.done; touch(t); commit(); } return; }
    const check = e.target.closest('.task-check');
    if (check) { e.stopPropagation(); check.classList.add('pop'); const row = check.closest('.task'); if (navigator.vibrate) navigator.vibrate(6); setTimeout(() => completeWithUndo(row.dataset.id), 140); return; }
    const row = e.target.closest('.task');
    if (row) openTaskSheet(row.dataset.id);
  });

  content.addEventListener('input', (e) => {
    if (e.target.id === 'search-input') { SEARCH.q = e.target.value; renderSearchResultsOnly(); }
  });
}
const renderSearchResultsOnly = debounce(() => { const si = $('#search-input'); const pos = si ? si.selectionStart : 0; render(); const si2 = $('#search-input'); if (si2) { si2.focus(); try { si2.setSelectionRange(pos, pos); } catch (_) {} } }, 120);

// Réordonnancement par la poignée (souris et tactile)
function startDrag(e, row) {
  e.preventDefault();
  const group = row.closest('.group'); if (!group) return;
  const pid = e.pointerId;
  const ghost = row.cloneNode(true);
  ghost.classList.add('drag-ghost');
  const r = row.getBoundingClientRect();
  Object.assign(ghost.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
  document.body.appendChild(ghost);
  row.classList.add('dragging');
  const offY = e.clientY - r.top, offX = e.clientX - r.left;
  let target = null, before = false;
  const move = (ev) => {
    if (ev.pointerId !== pid) return;
    ghost.style.top = ev.clientY - offY + 'px'; ghost.style.left = ev.clientX - offX + 'px';
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const over = el && el.closest('.task');
    $$('.drop-before, .drop-after', group).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    target = null;
    if (over && over !== row && over.closest('.group') === group) {
      const rr = over.getBoundingClientRect();
      before = ev.clientY < rr.top + rr.height / 2;
      over.classList.add(before ? 'drop-before' : 'drop-after');
      target = over;
    }
    // Défilement automatique près des bords
    if (ev.clientY < 70) window.scrollBy(0, -8); else if (ev.clientY > innerHeight - 90) window.scrollBy(0, 8);
  };
  const up = (ev) => {
    if (ev.pointerId !== pid) return;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    ghost.remove(); row.classList.remove('dragging');
    $$('.drop-before, .drop-after', group).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    suppressClickUntil = Date.now() + 300;
    if (!target) return;
    const ids = $$('.task', group).map((x) => x.dataset.id).filter((id) => id !== row.dataset.id);
    const idx = ids.indexOf(target.dataset.id) + (before ? 0 : 1);
    ids.splice(idx, 0, row.dataset.id);
    // Réattribue des ordres croissants à tout le groupe (simple et robuste)
    const orders = ids.map((id) => getTask(id)?.order ?? 0).sort((a, b) => a - b);
    const base = orders.length ? orders[0] : 0;
    ids.forEach((id, i) => { const t = getTask(id); if (t) { t.order = base + i; touch(t); } });
    commit();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}

/* ===================== Feuilles (modales empilables) ===================== */
const sheets = [];
function openSheet({ title, body, foot = '', onMount, onClose, cls = '' }) {
  const el = document.createElement('div');
  el.className = 'sheet ' + cls;
  el.style.zIndex = 40 + sheets.length * 2;
  el.innerHTML = `<div class="sheet-grab"></div>
    <div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
  $('#sheet-root').appendChild(el);
  $('#backdrop').classList.add('show');
  requestAnimationFrame(() => el.classList.add('show'));
  const api = { el, close: () => closeSheet(api), closed: false };
  api.onClose = onClose;
  sheets.push(api);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
  // Glisser vers le bas pour fermer (mobile)
  const grab = $('.sheet-grab', el);
  let sy = null;
  grab.addEventListener('pointerdown', (e) => { sy = e.clientY; grab.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
  grab.addEventListener('pointermove', (e) => { if (sy === null) return; const dy = Math.max(0, e.clientY - sy); el.style.transform = `translateY(${dy}px)`; });
  const endGrab = (e) => { if (sy === null) return; const dy = e.clientY - sy; sy = null; el.style.transition = ''; if (dy > 110) api.close(); else el.style.transform = ''; };
  grab.addEventListener('pointerup', endGrab); grab.addEventListener('pointercancel', endGrab);
  if (onMount) onMount(el, api);
  return api;
}
function closeSheet(api) {
  if (api.closed) return; api.closed = true;
  const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
  if (api.onClose) api.onClose();
  api.el.classList.remove('show');
  setTimeout(() => api.el.remove(), 260);
  if (!sheets.length) $('#backdrop').classList.remove('show');
}
function closeTopSheet() { if (sheets.length) sheets[sheets.length - 1].close(); }
function confirmDialog(title, text, { ok = 'Confirmer', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const api = openSheet({
      title: esc(title),
      body: `<p style="margin:4px 0 8px;color:var(--ink-soft)">${esc(text)}</p>`,
      foot: `<span class="spacer"></span><button class="btn ghost" data-close>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onMount: (el) => { $('[data-ok]', el).addEventListener('click', () => { done = true; resolve(true); api.close(); }); },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

/* ===================== Feuille : tâche ===================== */
function openTaskSheet(id, { isNew = false } = {}) {
  const t = getTask(id); if (!t) return;
  const listChips = () => allLists().map((l) => `<button type="button" class="opt ${t.listId === l.id ? 'on' : ''}" data-list="${l.id}"><span class="emoji">${esc(l.emoji || '')}</span>${esc(l.name)}</button>`).join('');
  const swatches = () => `<button type="button" class="swatch none ${!t.color ? 'on' : ''}" data-color="" title="Couleur de la liste"></button>` +
    COLORS.map((c) => `<button type="button" class="swatch ${t.color === c.id ? 'on' : ''}" data-color="${c.id}" style="--c:${c.hex}" title="${c.name}"></button>`).join('');
  const subHTML = () => {
    const subs = t.subtasks || []; const d = subs.filter((s) => s.done).length;
    return (subs.length ? `<div class="progress"><i style="--p:${Math.round((d / subs.length) * 100)}%"></i></div>` : '') +
      subs.map((s) => `<div class="subtask ${s.done ? 'done' : ''}" data-sub="${s.id}"><button type="button" class="cb" aria-label="Cocher">${icon('check')}</button><input value="${esc(s.title)}" placeholder="Sous-tâche"><button type="button" class="icon-btn small rm" aria-label="Retirer">${icon('x')}</button></div>`).join('') +
      `<div class="subtask-add">${icon('plus')}<input id="sub-new" placeholder="Ajouter une sous-tâche… (Entrée)"></div>`;
  };
  const body = `
    <input class="input title-input" id="t-title" value="${esc(t.title)}" placeholder="Titre de la tâche">
    <div class="field"><label>${icon('note')} Détails</label><textarea class="textarea" id="t-notes" rows="3" placeholder="Notes, liens, idées…">${esc(t.notes || '')}</textarea></div>
    <div class="field"><div class="lbl">${icon('all')} Liste</div><div class="chips" id="t-lists">${listChips()}</div></div>
    <div class="field"><div class="lbl">${icon('palette')} Couleur</div><div class="swatches" id="t-colors">${swatches()}</div></div>
    <div class="field"><div class="lbl">${icon('flag')} Priorité</div><div class="seg" id="t-prio">${PRIORITIES.map((p) => `<button type="button" class="${t.priority === p.v ? 'on' : ''} ${p.v ? 'prio-' + p.v : ''}" data-prio="${p.v}">${p.v ? icon('flag') : ''}${p.label}</button>`).join('')}</div></div>
    <div class="field"><div class="lbl">${icon('calendar')} Échéance</div>
      <div class="row"><input class="input" type="date" id="t-date" value="${t.due ? toDateInput(t.due) : ''}"><input class="input" type="time" id="t-time" value="${t.due && !t.allDay ? toTimeInput(t.due) : ''}"></div>
      <div class="quick-dates">
        <button type="button" class="btn sm ghost" data-qd="0">Aujourd’hui</button>
        <button type="button" class="btn sm ghost" data-qd="1">Demain</button>
        <button type="button" class="btn sm ghost" data-qd="sat">Ce week-end</button>
        <button type="button" class="btn sm ghost" data-qd="mon">Lundi prochain</button>
        <button type="button" class="btn sm ghost" data-qd="none">Aucune</button>
      </div>
    </div>
    <div class="field"><label>${icon('repeat')} Répéter</label><select class="select" id="t-repeat">${REPEATS.map((r) => `<option value="${r.v}" ${(t.repeat?.type || 'none') === r.v ? 'selected' : ''}>${r.label}</option>`).join('')}</select>
      <div class="hint" id="t-repeat-hint">${t.repeat && t.repeat.type !== 'none' ? 'La tâche renaît automatiquement à la prochaine date quand tu la termines.' : ''}</div></div>
    <div class="field"><div class="lbl">${icon('tag')} Étiquettes</div><div class="tagbox" id="t-tags">${(t.tags || []).map((tg) => `<span class="tg" data-tag="${esc(tg)}">#${esc(tg)}<button type="button" aria-label="Retirer">${icon('x')}</button></span>`).join('')}<input id="tag-new" placeholder="Ajouter… (Entrée)"></div></div>
    <div class="section-title">${icon('done')} Sous-tâches</div>
    <div class="subtasks" id="t-subs">${subHTML()}</div>
    <div class="toggle-row"><div><div class="t">Épingler</div><div class="d">Reste en haut et apparaît dans « Aujourd’hui »</div></div><button type="button" class="switch ${t.pinned ? 'on' : ''}" id="t-pin" role="switch" aria-checked="${t.pinned}"></button></div>
    <div class="hint">Créée le ${fmt.full.format(new Date(t.createdAt))}${t.doneAt ? ` · terminée le ${fmt.full.format(new Date(t.doneAt))}` : ''}</div>`;
  const foot = `<button type="button" class="btn ghost danger" id="t-del">${icon('trash')} Supprimer</button><button type="button" class="btn ghost" id="t-dup" title="Dupliquer">${icon('copy')}</button><span class="spacer"></span><button type="button" class="btn primary" data-close>${icon('check')} OK</button>`;

  let closedByDelete = false;
  openSheet({
    title: isNew ? 'Nouvelle tâche' : 'Tâche', body, foot,
    onMount: (el, api) => {
      const patch = (p, opts) => updateTask(id, p, opts);
      const dPatch = debounce((p) => patch(p), 350);
      const title = $('#t-title', el), notes = $('#t-notes', el);
      title.addEventListener('input', () => dPatch({ title: title.value }));
      title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); notes.focus(); } });
      notes.addEventListener('input', () => { autoGrow(notes); dPatch({ notes: notes.value }); });
      autoGrow(notes);
      $('#t-lists', el).addEventListener('click', (e) => { const b = e.target.closest('[data-list]'); if (!b) return; patch({ listId: b.dataset.list }); $$('[data-list]', el).forEach((x) => x.classList.toggle('on', x === b)); });
      $('#t-colors', el).addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (!b) return; patch({ color: b.dataset.color || null }); $$('[data-color]', el).forEach((x) => x.classList.toggle('on', x === b)); });
      $('#t-prio', el).addEventListener('click', (e) => { const b = e.target.closest('[data-prio]'); if (!b) return; patch({ priority: +b.dataset.prio }); $$('[data-prio]', el).forEach((x) => x.classList.toggle('on', x === b)); });
      const date = $('#t-date', el), time = $('#t-time', el);
      const applyDue = () => { const d = fromInputs(date.value, time.value); patch({ due: d ? d.toISOString() : null, allDay: !time.value }); };
      date.addEventListener('change', applyDue); time.addEventListener('change', applyDue);
      el.addEventListener('click', (e) => {
        const q = e.target.closest('[data-qd]'); if (!q) return;
        const v = q.dataset.qd; const today = startOfDay(new Date());
        if (v === 'none') { date.value = ''; time.value = ''; }
        else if (v === 'sat') date.value = toDateInput(nextDow(6));
        else if (v === 'mon') date.value = toDateInput(nextDow(1));
        else date.value = toDateInput(addDays(today, +v));
        applyDue();
      });
      $('#t-repeat', el).addEventListener('change', (e) => {
        const v = e.target.value;
        patch({ repeat: v === 'none' ? null : { type: v, interval: 1 } });
        $('#t-repeat-hint', el).textContent = v === 'none' ? '' : (getTask(id).due ? 'La tâche renaît automatiquement à la prochaine date quand tu la termines.' : 'Ajoute une échéance pour que la répétition fonctionne.');
      });
      // Étiquettes
      const tagbox = $('#t-tags', el), tagNew = $('#tag-new', el);
      const addTag = () => { const v = tagNew.value.replace(/^#/, '').trim().toLowerCase().replace(/\s+/g, '-'); if (!v) return; const tags = [...new Set([...(getTask(id).tags || []), v])]; patch({ tags }); tagNew.value = ''; tagNew.insertAdjacentHTML('beforebegin', `<span class="tg" data-tag="${esc(v)}">#${esc(v)}<button type="button" aria-label="Retirer">${icon('x')}</button></span>`); };
      tagNew.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addTag(); } else if (e.key === 'Backspace' && !tagNew.value) { const last = $$('.tg', tagbox).pop(); if (last) { patch({ tags: (getTask(id).tags || []).filter((x) => x !== last.dataset.tag) }); last.remove(); } } });
      tagNew.addEventListener('blur', addTag);
      tagbox.addEventListener('click', (e) => { const b = e.target.closest('.tg button'); if (!b) return; const tg = b.parentElement.dataset.tag; patch({ tags: (getTask(id).tags || []).filter((x) => x !== tg) }); b.parentElement.remove(); if (e.target === tagbox) tagNew.focus(); });
      // Sous-tâches
      const subs = $('#t-subs', el);
      const refreshSubs = (focusNew) => { subs.innerHTML = subHTML(); if (focusNew) $('#sub-new', subs).focus(); };
      subs.addEventListener('keydown', (e) => {
        if (e.target.id === 'sub-new' && e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (!v) return; const tk = getTask(id); tk.subtasks = [...(tk.subtasks || []), { id: uid(), title: v, done: false }]; touch(tk); commit(); refreshSubs(true); }
        else if (e.target.closest('.subtask') && e.key === 'Enter') { e.preventDefault(); $('#sub-new', subs).focus(); }
      });
      subs.addEventListener('input', (e) => { const row = e.target.closest('.subtask'); if (!row) return; const tk = getTask(id); const s = tk.subtasks.find((x) => x.id === row.dataset.sub); if (s) { s.title = e.target.value; dPatch({ subtasks: tk.subtasks }); } });
      subs.addEventListener('click', (e) => {
        const row = e.target.closest('.subtask'); if (!row) return; const tk = getTask(id); const s = tk.subtasks.find((x) => x.id === row.dataset.sub); if (!s) return;
        if (e.target.closest('.cb')) { s.done = !s.done; touch(tk); commit(); refreshSubs(false); }
        else if (e.target.closest('.rm')) { tk.subtasks = tk.subtasks.filter((x) => x !== s); touch(tk); commit(); refreshSubs(false); }
      });
      $('#t-pin', el).addEventListener('click', (e) => { const on = !e.currentTarget.classList.contains('on'); e.currentTarget.classList.toggle('on', on); e.currentTarget.setAttribute('aria-checked', on); patch({ pinned: on }); });
      $('#t-del', el).addEventListener('click', () => { closedByDelete = true; api.close(); deleteWithUndo(id); });
      $('#t-dup', el).addEventListener('click', () => { const src = getTask(id); const cp = newTask({ ...clone(src), id: uid(), title: src.title + ' (copie)', done: false, doneAt: null, createdAt: nowISO(), subtasks: (src.subtasks || []).map((s) => ({ ...s, id: uid(), done: false })) }); commit(); api.close(); toast('Tâche dupliquée'); openTaskSheet(cp.id); });
      if (isNew) setTimeout(() => { title.focus(); title.select(); }, 80);
    },
    onClose: () => {
      const tk = getTask(id); if (!tk || closedByDelete) return;
      const title = tk.title.trim();
      if (!title) { if (isNew) { tk.deleted = true; touch(tk); commit(); } else { tk.title = 'Sans titre'; touch(tk); commit(); } }
    },
  });
}
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 8, 320) + 'px'; }

/* ===================== Feuille : liste ===================== */
const EMOJI_SUGG = ['📚', '🎓', '🐈', '🏡', '💖', '🛒', '💼', '🎨', '🧘', '🍳', '💪', '✈️', '🎁', '📝', '🌱', '🎵', '💊', '🚗', '🧺', '📞', '🎉', '🧠'];
function openListSheet(id) {
  const isNew = !id;
  const l = isNew ? { name: '', emoji: '📝', color: 'nymphea' } : getList(id);
  if (!l) return;
  const body = `
    <div class="field"><label>${icon('edit')} Nom</label><input class="input" id="l-name" value="${esc(l.name)}" placeholder="Ex : Mémoire, Cours de 4e, Vétérinaire…"></div>
    <div class="field"><label>Emoji</label><div class="row"><input class="input" id="l-emoji" value="${esc(l.emoji || '')}" maxlength="4" style="max-width:90px;text-align:center;font-size:22px"><div class="chips" style="flex:4">${EMOJI_SUGG.map((e) => `<button type="button" class="opt" data-emoji="${e}" style="padding:5px 8px;font-size:18px">${e}</button>`).join('')}</div></div></div>
    <div class="field"><div class="lbl">${icon('palette')} Couleur</div><div class="swatches" id="l-colors">${COLORS.map((c) => `<button type="button" class="swatch ${l.color === c.id ? 'on' : ''}" data-color="${c.id}" style="--c:${c.hex}" title="${c.name}"></button>`).join('')}</div></div>`;
  const foot = `${!isNew && !l.system ? `<button type="button" class="btn ghost danger" id="l-del">${icon('trash')} Supprimer</button>` : ''}<span class="spacer"></span><button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn primary" id="l-ok">${icon('check')} ${isNew ? 'Créer' : 'Enregistrer'}</button>`;
  openSheet({
    title: isNew ? 'Nouvelle liste' : 'Modifier la liste', body, foot,
    onMount: (el, api) => {
      let color = l.color;
      $('#l-colors', el).addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (!b) return; color = b.dataset.color; $$('[data-color]', el).forEach((x) => x.classList.toggle('on', x === b)); });
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-emoji]'); if (b) $('#l-emoji', el).value = b.dataset.emoji; });
      const ok = () => {
        const name = $('#l-name', el).value.trim(); if (!name) { $('#l-name', el).focus(); return; }
        const emoji = $('#l-emoji', el).value.trim();
        if (isNew) { const nl = newList({ name, emoji, color }); commit(); api.close(); go('list', nl.id); }
        else { Object.assign(l, { name, emoji, color }); touch(l); commit(); api.close(); }
      };
      $('#l-ok', el).addEventListener('click', ok);
      $('#l-name', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      const del = $('#l-del', el);
      if (del) del.addEventListener('click', async () => {
        const n = activeTasks().filter((t) => t.listId === l.id && !t.done).length;
        if (await confirmDialog(`Supprimer « ${l.name} » ?`, n ? `${plural(n, 'tâche')} en cours seront déplacées dans la Boîte de réception.` : 'La liste sera retirée du carnet.')) { api.close(); deleteList(l.id); go('today'); toast('Liste supprimée'); }
      });
      if (isNew) setTimeout(() => $('#l-name', el).focus(), 80);
    },
  });
}

/* ===================== Popover (menu d'affichage) ===================== */
function openPopover(anchor, items) {
  closePopover();
  const pop = document.createElement('div');
  pop.className = 'popover';
  pop.innerHTML = items.map((it) => it === '-' ? '<div class="sep"></div>' : it.head ? `<div class="ph">${esc(it.head)}</div>` : `<button class="pi ${it.on ? 'on' : ''} ${it.danger ? 'danger' : ''}" data-i="${items.indexOf(it)}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span></button>`).join('');
  $('#popover-root').appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = r.bottom + 6 + 'px';
  pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; closePopover(); items[+b.dataset.i].action(); });
  setTimeout(() => { document.addEventListener('pointerdown', outside, { once: true }); }, 0);
  function outside(e) { if (!pop.contains(e.target)) closePopover(); else document.addEventListener('pointerdown', outside, { once: true }); }
  window.addEventListener('scroll', closePopover, { once: true });
}
function closePopover() { $('#popover-root').innerHTML = ''; }

function openViewMenu(anchor) {
  const sorts = [['manual', 'Ordre manuel (glisser)', 'drag'], ['due', 'Par échéance', 'calendar'], ['priority', 'Par priorité', 'flag'], ['alpha', 'Alphabétique', 'sort'], ['created', 'Plus récentes d’abord', 'clock']];
  const items = [{ head: 'Trier' }, ...sorts.map(([v, label, ic]) => ({ label, icon: ic, on: state.settings.sortBy === v, action: () => { state.settings.sortBy = v; commit({ sync: false }); } }))];
  if (view.type === 'list') {
    const l = getList(view.id);
    items.push('-', { label: 'Modifier la liste', icon: 'edit', action: () => openListSheet(l.id) });
    if (!l.system) items.push({ label: 'Supprimer la liste', icon: 'trash', danger: true, action: async () => { if (await confirmDialog(`Supprimer « ${l.name} » ?`, 'Les tâches en cours iront dans la Boîte de réception.')) { deleteList(l.id); go('today'); } } });
  }
  items.push('-', { label: state.settings.theme === 'dark' ? 'Thème : nocturne' : state.settings.theme === 'light' ? 'Thème : jour' : 'Thème : automatique', icon: state.settings.theme === 'dark' ? 'moon' : 'sun', action: cycleTheme });
  openPopover(anchor, items);
}

/* ===================== Thème ===================== */
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % order.length];
  applyTheme(); commit({ sync: false });
  toast({ auto: 'Thème automatique (suit l’iPhone / le Mac)', light: 'Thème jour ☀️', dark: 'Thème nocturne 🌙' }[state.settings.theme]);
}

/* ===================== Synchronisation (chiffrée de bout en bout) ===================== */
const subtle = (globalThis.crypto && crypto.subtle) || null;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const keyCache = new Map();
async function deriveKey(pass) {
  if (keyCache.has(pass)) return keyCache.get(pass);
  const base = await subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('carnet-sync-v1'), iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  keyCache.set(pass, key); return key;
}
async function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const pass = state.settings.sync.passphrase;
  if (pass) {
    if (!subtle) throw new Error('Le chiffrement nécessite HTTPS (ou localhost). Retire la phrase secrète ou passe en HTTPS.');
    const key = await deriveKey(pass);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json));
    return `enc:v1:${b64(iv)}:${b64(new Uint8Array(ct))}`;
  }
  return 'json:' + json;
}
async function decodePayload(payload) {
  if (!payload) return null;
  if (payload.startsWith('json:')) return JSON.parse(payload.slice(5));
  if (payload.startsWith('enc:v1:')) {
    const pass = state.settings.sync.passphrase;
    if (!pass) throw new Error('Le coffre est chiffré : saisis la phrase secrète.');
    if (!subtle) throw new Error('Le déchiffrement nécessite HTTPS (ou localhost).');
    const [, , ivs, cts] = payload.split(':');
    try {
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivs) }, await deriveKey(pass), unb64(cts));
      return JSON.parse(dec.decode(pt));
    } catch (_) { throw new Error('Phrase secrète incorrecte.'); }
  }
  throw new Error('Format de coffre inconnu.');
}
function mergeItems(local, remote) {
  const map = new Map(local.map((x) => [x.id, x]));
  let pulled = false, localNewer = false;
  const remoteIds = new Set();
  for (const r of remote || []) {
    if (!r || !r.id) continue;
    remoteIds.add(r.id);
    const l = map.get(r.id);
    if (!l) { map.set(r.id, r); pulled = true; }
    else if ((r.updatedAt || '') > (l.updatedAt || '')) { map.set(r.id, r); pulled = true; }
    else if ((r.updatedAt || '') < (l.updatedAt || '')) localNewer = true;
  }
  for (const l of local) if (!remoteIds.has(l.id)) localNewer = true;
  return { items: [...map.values()], pulled, localNewer };
}
function gcTombstones() {
  const limit = new Date(Date.now() - 30 * 864e5).toISOString();
  state.tasks = state.tasks.filter((t) => !(t.deleted && (t.updatedAt || '') < limit));
  state.lists = state.lists.filter((l) => !(l.deleted && (l.updatedAt || '') < limit));
}
async function api(method, path, body, headers = {}) {
  const s = state.settings.sync;
  const url = s.url.replace(/\/+$/, '') + path;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + s.token, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal, cache: 'no-store' });
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'Serveur injoignable (délai dépassé).' : 'Serveur injoignable.'); }
  finally { clearTimeout(to); }
  let data = null; try { data = await res.json(); } catch (_) {}
  if (res.status === 409) return { status: 409, ...data };
  if (res.status === 401) throw new Error('Jeton refusé par le serveur.');
  if (!res.ok) throw new Error((data && data.error) || `Erreur ${res.status}`);
  return { status: res.status, ...data };
}

const SYNC = { busy: false, again: false, status: 'local', error: null };
function setSyncStatus(status, error = null) {
  SYNC.status = status; SYNC.error = error;
  const pill = $('#sync-pill'); pill.dataset.status = status;
  const s = state.settings.sync;
  const labels = { local: 'Local seulement', ok: s.lastSyncAt ? 'Synchro ' + fmt.time.format(new Date(s.lastSyncAt)) : 'Synchronisé', syncing: 'Synchronisation…', error: 'Erreur de synchro', offline: 'Hors-ligne' };
  $('.label', pill).textContent = labels[status] || status;
  pill.title = error || labels[status] || '';
  document.dispatchEvent(new CustomEvent('syncstatus'));
}
const scheduleSync = debounce(() => runSync(), 1500);
async function runSync({ manual = false } = {}) {
  const s = state.settings.sync;
  if (!s.enabled || !s.url || !s.token) { setSyncStatus('local'); return false; }
  if (!navigator.onLine) { setSyncStatus('offline'); return false; }
  if (SYNC.busy) { SYNC.again = true; return false; }
  SYNC.busy = true; setSyncStatus('syncing');
  let ok = false;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const mutationsAtStart = state.meta.mutations || 0;
      const res = await api('GET', '/api/vault');
      const remote = (await decodePayload(res.payload)) || { tasks: [], lists: [] };
      const mt = mergeItems(state.tasks, remote.tasks || []);
      const ml = mergeItems(state.lists, remote.lists || []);
      state.tasks = mt.items; state.lists = ml.items; gcTombstones();
      if (mt.pulled || ml.pulled) { save(); render(); }
      const needPush = state.meta.dirty || mt.localNewer || ml.localNewer || !res.payload;
      if (needPush) {
        const payload = await encodePayload({ v: 1, tasks: state.tasks, lists: state.lists, at: nowISO() });
        const put = await api('PUT', '/api/vault', { payload }, { 'If-Match': String(res.rev) });
        if (put.status === 409) continue; // l'autre appareil a écrit entre-temps → on refusionne
        s.lastRev = put.rev;
      } else s.lastRev = res.rev;
      if ((state.meta.mutations || 0) === mutationsAtStart) state.meta.dirty = false; else SYNC.again = true;
      s.lastSyncAt = nowISO(); save(); setSyncStatus('ok'); ok = true; break;
    }
    if (!ok) throw new Error('Conflits répétés, nouvel essai plus tard.');
  } catch (e) {
    setSyncStatus('error', e.message);
    if (manual) toast('Synchro : ' + e.message, { ms: 7000 });
  } finally {
    SYNC.busy = false;
    if (SYNC.again) { SYNC.again = false; setTimeout(() => runSync(), 500); }
  }
  return ok;
}

/* ===================== Réglages ===================== */
function openSettingsSheet() {
  const s = state.settings; const sy = s.sync;
  const secure = window.isSecureContext;
  const stats = computeStats();
  const body = `
    <div class="section-title">${icon('heart')} Toi</div>
    <div class="field"><label>Prénom (pour le bonjour du matin)</label><input class="input" id="s-name" value="${esc(s.name)}" placeholder="Ton prénom"></div>
    <div class="section-title">${icon('brush')} Apparence</div>
    <div class="seg" id="s-theme">${[['auto', 'Auto'], ['light', 'Jour'], ['dark', 'Nocturne']].map(([v, l]) => `<button type="button" class="${s.theme === v ? 'on' : ''}" data-theme="${v}">${v === 'light' ? icon('sun') : v === 'dark' ? icon('moon') : icon('sparkle')}${l}</button>`).join('')}</div>

    <div class="section-title">${icon('sync')} Synchronisation Mac ↔ iPhone</div>
    <div class="toggle-row"><div><div class="t">Activer la synchro</div><div class="d">Via ton serveur Carnet personnel (voir README)</div></div><button type="button" class="switch ${sy.enabled ? 'on' : ''}" id="s-sync-on" role="switch"></button></div>
    <div class="field"><label>Adresse du serveur</label><input class="input" id="s-url" value="${esc(sy.url)}" placeholder="https://macbook.tailnet.ts.net  ou  http://192.168.1.20:8787" inputmode="url" autocapitalize="off" autocorrect="off"></div>
    <div class="field"><label>Jeton (affiché au lancement du serveur)</label><input class="input" id="s-token" value="${esc(sy.token)}" placeholder="Jeton" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
    <div class="field"><label>Phrase secrète (chiffrement de bout en bout, optionnel mais conseillé)</label><input class="input" id="s-pass" type="password" value="${esc(sy.passphrase)}" placeholder="La même sur les deux appareils" autocapitalize="off">
      <div class="hint">${secure ? 'Les données sont chiffrées sur l’appareil avant l’envoi ; le serveur ne voit qu’un blob illisible.' : '⚠️ Cette page est ouverte en HTTP : le chiffrement de bout en bout et le mode hors-ligne ne sont pas disponibles. Sur ton réseau Wi-Fi maison ça reste privé, mais préfère HTTPS (Tailscale) — voir README.'}</div></div>
    <div class="row"><button type="button" class="btn" id="s-test">${icon('sync')} Tester et synchroniser</button></div>
    <div class="status-line" id="s-status">${syncStatusText()}</div>

    <div class="section-title">${icon('bell')} Rappels</div>
    <div class="toggle-row"><div><div class="t">Notifications</div><div class="d">Un rappel quand une tâche avec heure approche (app ouverte ou installée)</div></div><button type="button" class="switch ${s.notifications ? 'on' : ''}" id="s-notif" role="switch"></button></div>

    <div class="section-title">${icon('stats')} Statistiques</div>
    <div class="stats">
      <div class="stat"><b>${stats.doneTotal}</b><span>terminées au total</span></div>
      <div class="stat"><b>${stats.doneWeek}</b><span>cette semaine</span></div>
      <div class="stat"><b>${stats.streak} 🔥</b><span>jours d’affilée</span></div>
      <div class="stat"><b>${stats.open}</b><span>en cours</span></div>
    </div>
    <div class="bars">${stats.perList.map((x) => `<div class="bar"><span class="nm">${esc(x.emoji)} ${esc(x.name)}</span><span class="tr"><i style="--p:${x.pct}%;--c:${x.color}"></i></span><span class="v">${x.n}</span></div>`).join('')}</div>

    <div class="section-title">${icon('download')} Données</div>
    <div class="row"><button type="button" class="btn" id="s-export">${icon('download')} Exporter</button><button type="button" class="btn" id="s-import">${icon('upload')} Importer</button><input type="file" id="s-file" accept="application/json,.json" hidden></div>
    <div class="hint">L’export est un fichier JSON lisible que tu peux garder en sauvegarde (iCloud Drive, clé USB…).</div>
    <div style="margin-top:10px"><button type="button" class="btn ghost danger sm" id="s-reset">${icon('trash')} Tout effacer sur cet appareil</button></div>

    <div class="section-title">${icon('sparkle')} Astuces de saisie</div>
    <div class="hint">Dans la barre d’ajout, écris naturellement :<br>
      <code>Rendre le mémoire vendredi 17h !!!</code> → échéance + priorité haute<br>
      <code>Vermifuge du chat tous les mois @chat</code> → récurrence + liste<br>
      <code>Préparer cours 4e demain matin #cours</code> → « demain matin » = 9h, étiquette #cours<br>
      Mots compris : aujourd’hui, demain, après-demain, lundi…dimanche, ce week-end, semaine prochaine, dans 3 jours, le 12, 12/10, 3 mars, 17h, 17h30, midi, ce soir, !, !!, !!!, #tag, @liste, tous les jours / semaines / mois / lundis, en semaine.</div>
    <div class="hint" style="margin-top:8px">Raccourcis (Mac) : <span class="kbd">/</span> ajouter · <span class="kbd">⌘K</span> rechercher · <span class="kbd">Échap</span> fermer. Glisse une tâche → droite pour terminer, ← gauche pour supprimer.</div>
    <div class="hint" style="margin-top:8px">Sur iPhone : Safari → Partager → <b>« Sur l’écran d’accueil »</b> pour avoir Carnet comme une vraie app. Sur Mac : Safari → Fichier → <b>« Ajouter au Dock »</b>.</div>
    <div class="hint" style="margin-top:12px;text-align:center">Carnet · fait avec amour, sans cloud ni pub 💐</div>`;
  openSheet({
    title: 'Réglages', body,
    onMount: (el, apiS) => {
      $('#s-name', el).addEventListener('input', debounce((e) => { s.name = e.target.value.trim(); commit({ sync: false }); }, 300));
      $('#s-theme', el).addEventListener('click', (e) => { const b = e.target.closest('[data-theme]'); if (!b) return; s.theme = b.dataset.theme; applyTheme(); commit({ sync: false }); $$('[data-theme]', el).forEach((x) => x.classList.toggle('on', x === b)); });
      const readSync = () => { sy.url = $('#s-url', el).value.trim(); sy.token = $('#s-token', el).value.trim(); sy.passphrase = $('#s-pass', el).value; };
      ['#s-url', '#s-token', '#s-pass'].forEach((sel) => $(sel, el).addEventListener('change', () => { readSync(); keyCache.clear(); commit({ render: false, sync: false }); }));
      $('#s-sync-on', el).addEventListener('click', (e) => { readSync(); sy.enabled = !e.currentTarget.classList.contains('on'); e.currentTarget.classList.toggle('on', sy.enabled); commit({ sync: false }); if (sy.enabled) runSync({ manual: true }); else setSyncStatus('local'); });
      $('#s-test', el).addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        readSync(); keyCache.clear(); commit({ render: false, sync: false });
        if (!sy.url || !sy.token) { toast('Renseigne l’adresse et le jeton.'); return; }
        btn.disabled = true;
        try {
          const h = await fetch(sy.url.replace(/\/+$/, '') + '/api/health', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
          if (!h || !h.ok) throw new Error('Serveur injoignable à cette adresse.');
          sy.enabled = true; $('#s-sync-on', el).classList.add('on'); state.meta.dirty = true;
          const ok = await runSync({ manual: true });
          if (ok) toast('Synchronisation réussie ✓');
        } catch (err) { setSyncStatus('error', err.message); toast(err.message, { ms: 7000 }); }
        finally { btn.disabled = false; }
      });
      const onStatus = () => { const st = $('#s-status', el); if (st) { st.className = 'status-line ' + (SYNC.status === 'ok' ? 'ok' : SYNC.status === 'error' ? 'err' : ''); st.textContent = syncStatusText(); } };
      document.addEventListener('syncstatus', onStatus);
      apiS.onClose = () => document.removeEventListener('syncstatus', onStatus);
      $('#s-notif', el).addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const want = !btn.classList.contains('on');
        if (want) {
          if (!('Notification' in window)) { toast('Notifications non disponibles ici. Sur iPhone, installe d’abord Carnet sur l’écran d’accueil.', { ms: 7000 }); return; }
          const p = await Notification.requestPermission();
          if (p !== 'granted') { toast('Permission refusée.'); return; }
        }
        s.notifications = want; btn.classList.toggle('on', want); commit({ sync: false }); if (want) checkNotifications();
      });
      $('#s-export', el).addEventListener('click', exportData);
      $('#s-import', el).addEventListener('click', () => $('#s-file', el).click());
      $('#s-file', el).addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) await importData(f); e.target.value = ''; apiS.close(); });
      $('#s-reset', el).addEventListener('click', async () => {
        if (await confirmDialog('Tout effacer sur cet appareil ?', 'Les tâches et listes de cet appareil seront supprimées. Si la synchro est active, elles reviendront du serveur au prochain échange. Pense à exporter avant.', { ok: 'Effacer' })) {
          localStorage.removeItem(KEY); location.reload();
        }
      });
    },
  });
}
function syncStatusText() {
  const s = state.settings.sync;
  if (!s.enabled) return 'Synchro désactivée : les données restent sur cet appareil.';
  if (SYNC.status === 'error') return 'Erreur : ' + (SYNC.error || '');
  if (SYNC.status === 'syncing') return 'Synchronisation en cours…';
  if (SYNC.status === 'offline') return 'Hors-ligne — reprise automatique dès que le réseau revient.';
  return s.lastSyncAt ? 'Dernière synchro : ' + fmt.full.format(new Date(s.lastSyncAt)) : 'Pas encore synchronisé.';
}
function computeStats() {
  const tasks = activeTasks(); const done = tasks.filter((t) => t.done && t.doneAt);
  const now = new Date(); const weekStart = addDays(startOfDay(now), -((now.getDay() + 6) % 7));
  const doneWeek = done.filter((t) => new Date(t.doneAt) >= weekStart).length;
  const days = new Set(done.map((t) => toDateInput(t.doneAt)));
  let streak = 0; let d = startOfDay(now);
  if (!days.has(toDateInput(d))) d = addDays(d, -1);
  while (days.has(toDateInput(d))) { streak++; d = addDays(d, -1); }
  const open = tasks.filter((t) => !t.done);
  const max = Math.max(1, ...allLists().map((l) => open.filter((t) => t.listId === l.id).length));
  const perList = allLists().map((l) => { const n = open.filter((t) => t.listId === l.id).length; return { name: l.name, emoji: l.emoji || '', color: colorHex(l.color), n, pct: Math.round((n / max) * 100) }; }).filter((x) => x.n);
  return { doneTotal: done.length, doneWeek, streak, open: open.length, perList };
}
function exportData() {
  const data = { app: 'carnet', version: 1, exportedAt: nowISO(), tasks: activeTasks(), lists: allLists(), settings: { name: state.settings.name, theme: state.settings.theme } };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `carnet-${toDateInput(new Date())}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Export prêt 📦');
}
async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.tasks)) throw new Error('Fichier non reconnu.');
    const mt = mergeItems(state.tasks, data.tasks); const ml = mergeItems(state.lists, data.lists || []);
    state.tasks = mt.items; state.lists = ml.items;
    if (data.settings && data.settings.name && !state.settings.name) state.settings.name = data.settings.name;
    commit(); toast(`Import terminé : ${data.tasks.length} tâches, ${(data.lists || []).length} listes`);
  } catch (e) { toast('Import impossible : ' + e.message, { ms: 7000 }); }
}

/* ===================== Notifications (rappels) ===================== */
function checkNotifications() {
  if (!state.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  let notified = {}; try { notified = JSON.parse(localStorage.getItem('carnet.notified') || '{}'); } catch (_) {}
  const now = Date.now();
  for (const t of activeTasks()) {
    if (t.done || !t.due || t.allDay) continue;
    const at = new Date(t.due).getTime();
    if (at - now < 30 * 60e3 && at - now > -10 * 60e3 && notified[t.id] !== t.due) {
      notified[t.id] = t.due;
      try { new Notification(t.title, { body: `Prévu à ${fmt.time.format(new Date(t.due))}${getList(t.listId) ? ' · ' + getList(t.listId).name : ''}`, tag: 'carnet-' + t.id, icon: 'icons/icon-192.png' }); } catch (_) {}
    }
  }
  for (const k of Object.keys(notified)) if (!getTask(k)) delete notified[k];
  try { localStorage.setItem('carnet.notified', JSON.stringify(notified)); } catch (_) {}
}

/* ===================== Ajout rapide ===================== */
function bindQuickAdd() {
  const form = $('#quickadd'), input = $('#qa-input'), chips = $('#qa-chips');
  const ctx = () => ({ listId: view.type === 'list' ? view.id : null });
  const preview = () => {
    const v = input.value.trim();
    if (!v) { chips.innerHTML = ''; return; }
    const p = parseQuickAdd(v, ctx());
    const out = [];
    if (p.due) { const info = dueInfo({ due: p.due, allDay: p.allDay }); out.push(`<span class="chip accent">${icon(p.allDay ? 'calendar' : 'clock')}${esc(info.label)}</span>`); }
    if (p.priority) out.push(`<span class="chip"><span class="prio-${p.priority}">${icon('flag')}</span>${PRIORITIES[p.priority].label}</span>`);
    if (p.repeat) out.push(`<span class="chip">${icon('repeat')}${esc(repeatLabel(p.repeat))}</span>`);
    const l = getList(p.listId); if (l && p.listId !== inboxId()) out.push(`<span class="chip">${esc(l.emoji || '')} ${esc(l.name)}</span>`);
    for (const tg of p.tags) out.push(`<span class="chip">${icon('tag')}${esc(tg)}</span>`);
    if (out.length) out.unshift(`<span class="chip" style="border-style:dashed">${esc(p.title.length > 40 ? p.title.slice(0, 40) + '…' : p.title)}</span>`);
    chips.innerHTML = out.join('');
  };
  input.addEventListener('input', debounce(preview, 80));
  const add = (openDetails) => {
    const v = input.value.trim();
    if (!v && !openDetails) return;
    const p = v ? parseQuickAdd(v, ctx()) : { title: '', tags: [], listId: ctx().listId, priority: 0, due: null, allDay: true, repeat: null };
    const t = newTask({ title: p.title, due: p.due, allDay: p.allDay, priority: p.priority, tags: p.tags, listId: p.listId || inboxId(), repeat: p.repeat });
    input.value = ''; chips.innerHTML = '';
    commit();
    if (openDetails) openTaskSheet(t.id, { isNew: true });
    else { if (navigator.vibrate) navigator.vibrate(5); input.focus(); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); add(false); });
  $('#qa-more').addEventListener('click', () => add(true));
}

/* ===================== Barre latérale & navigation ===================== */
function openSidebar() { $('#sidebar').classList.add('open'); $('#backdrop').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); if (!sheets.length) $('#backdrop').classList.remove('show'); }
function bindChrome() {
  $('#btn-menu').addEventListener('click', openSidebar);
  $('#btn-close-sidebar').addEventListener('click', closeSidebar);
  $('#backdrop').addEventListener('click', () => { if (sheets.length) closeTopSheet(); else closeSidebar(); });
  $('#sidebar').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) { go(b.dataset.go, b.dataset.id); closeSidebar(); } });
  $('#btn-new-list').addEventListener('click', () => { closeSidebar(); openListSheet(null); });
  $('#btn-settings').addEventListener('click', () => { closeSidebar(); openSettingsSheet(); });
  $('#sync-pill').addEventListener('click', () => { if (state.settings.sync.enabled) { runSync({ manual: true }); } else { closeSidebar(); openSettingsSheet(); } });
  $('#btn-search').addEventListener('click', () => go('search'));
  $('#btn-view-menu').addEventListener('click', (e) => openViewMenu(e.currentTarget));
  window.addEventListener('hashchange', () => { view = parseHash(); closePopover(); render(); window.scrollTo(0, 0); });
  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape') { if ($('#popover-root').children.length) closePopover(); else if (sheets.length) closeTopSheet(); else if ($('#sidebar').classList.contains('open')) closeSidebar(); else if (typing) document.activeElement.blur(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); go('search'); setTimeout(() => $('#search-input')?.focus(), 50); return; }
    if (typing || sheets.length) return;
    if (e.key === '/' || e.key === 'n') { e.preventDefault(); $('#qa-input').focus(); }
  });
  // Balayage depuis le bord gauche pour ouvrir le menu (mobile)
  let edge = null;
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && e.clientX < 24 && !sheets.length) edge = { x: e.clientX, y: e.clientY }; });
  document.addEventListener('pointermove', (e) => { if (edge && e.clientX - edge.x > 60 && Math.abs(e.clientY - edge.y) < 40) { openSidebar(); edge = null; } });
  document.addEventListener('pointerup', () => { edge = null; });
  window.addEventListener('online', () => runSync());
  window.addEventListener('offline', () => { if (state.settings.sync.enabled) setSyncStatus('offline'); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { render(); runSync(); checkNotifications(); } });
  setInterval(() => { if (document.visibilityState === 'visible') { runSync(); checkNotifications(); } }, 60000);
  // À minuit, les groupes « aujourd’hui / en retard » changent
  setInterval(() => { if (document.visibilityState === 'visible') render(); }, 5 * 60000);
}

/* ===================== Premier lancement ===================== */
function seedDefaults() {
  if (!state.lists.length) {
    DEFAULT_LISTS.forEach((l, i) => newList({ ...l, order: i, createdAt: SEED_TIME, updatedAt: SEED_TIME }));
  }
  if (!state.tasks.length) {
    const samples = [
      { id: 's-1', title: 'Glisse-moi vers la droite pour me terminer ✅', notes: 'Un balayage vers la gauche supprime. Tu peux annuler pendant quelques secondes.', listId: 'inbox', pinned: true },
      { id: 's-2', title: 'Appuie sur moi pour voir les détails ✨', notes: 'Ici tu peux ajouter des notes, une liste, une couleur, une priorité, une date, une répétition, des étiquettes et des sous-tâches.', listId: 'inbox', subtasks: [{ id: 's-2a', title: 'Ouvrir la tâche', done: false }, { id: 's-2b', title: 'Changer la couleur', done: false }, { id: 's-2c', title: 'Ajouter une sous-tâche', done: false }], color: 'renoir', pinned: true },
      { id: 's-3', title: 'Écris « demain 17h !! » dans la barre d’ajout', notes: 'Carnet comprend les dates, heures, priorités, #étiquettes et @listes écrites en français.', listId: 'inbox', priority: 1 },
      { id: 's-4', title: 'Câlins au chat', listId: 'l-chat', repeat: { type: 'daily', interval: 1 }, due: startOfDay(new Date()).toISOString(), allDay: true, tags: ['ronron'] },
      { id: 's-5', title: 'Un petit moment pour moi 🌸', listId: 'l-perso', priority: 2 },
    ];
    samples.forEach((s, i) => newTask({ ...s, order: i, createdAt: SEED_TIME, updatedAt: SEED_TIME }));
  }
}
function openWelcome() {
  openSheet({
    title: 'Bienvenue',
    body: `<div class="welcome"><div class="art"><span></span><span></span><span></span><span></span></div>
      <h3>Ton carnet t’attend</h3>
      <p>Un carnet de tâches tout doux, façon aquarelle. Tout reste sur tes appareils.</p>
      <input class="input" id="w-name" placeholder="Ton prénom (pour te dire bonjour)" style="text-align:center;max-width:320px;margin:0 auto" autocomplete="given-name">
    </div>`,
    foot: `<span class="spacer"></span><button type="button" class="btn primary" id="w-ok">${icon('sparkle')} Ouvrir le carnet</button>`,
    onMount: (el, apiW) => {
      const ok = () => { state.settings.name = $('#w-name', el).value.trim(); state.settings.onboarded = true; commit({ sync: false }); apiW.close(); };
      $('#w-ok', el).addEventListener('click', ok);
      $('#w-name', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      setTimeout(() => $('#w-name', el).focus(), 200);
    },
    onClose: () => { if (!state.settings.onboarded) { state.settings.onboarded = true; commit({ sync: false }); } },
  });
}

/* ===================== Démarrage ===================== */
function init() {
  load();
  applyTheme();
  seedDefaults();
  view = parseHash();
  bindChrome();
  bindGestures();
  bindQuickAdd();
  render();
  setSyncStatus(state.settings.sync.enabled ? 'ok' : 'local');
  if (!state.settings.onboarded) openWelcome();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  runSync();
  checkNotifications();
}
document.addEventListener('DOMContentLoaded', init);
