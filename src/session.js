// ── SESSION MANAGER ──────────────────────────────────────────────────────────
// Hierarchy: Project → PlateSession → SetupID
// All data stored in localStorage under key 'vp_planner_data'

const STORAGE_KEY = 'vp_planner_data';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { projects: [] };
  } catch { return { projects: [] }; }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// ── PROJECT ──────────────────────────────────────────────────────────────────
export function createProject(name) {
  const data = load();
  const project = {
    id: uid(),
    name: name.toUpperCase().replace(/\s+/g, '_'),
    createdAt: Date.now(),
    sessions: [],
  };
  data.projects.unshift(project);
  save(data);
  return project;
}

export function getProjects() {
  return load().projects;
}

export function deleteProject(projectId) {
  const data = load();
  data.projects = data.projects.filter(p => p.id !== projectId);
  save(data);
}

// ── PLATE SESSION ────────────────────────────────────────────────────────────
export function createSession(projectId, { location, description, stageProfileId, plateCameraId }) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return null;
  const session = {
    id: uid(),
    location: location.toUpperCase().replace(/\s+/g, '_'),
    description,
    stageProfileId,
    plateCameraId,
    createdAt: Date.now(),
    setups: [],
    screenshots: [],
  };
  project.sessions.unshift(session);
  save(data);
  return session;
}

export function getSessions(projectId) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  return project ? project.sessions : [];
}

export function deleteSession(projectId, sessionId) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  project.sessions = project.sessions.filter(s => s.id !== sessionId);
  save(data);
}

// ── SETUP ID ─────────────────────────────────────────────────────────────────
export function createSetup(projectId, sessionId, { type, variant, params }) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return null;
  const session = project.sessions.find(s => s.id === sessionId);
  if (!session) return null;

  const num = String(session.setups.length + 1).padStart(3, '0');
  const setupId = `SETUP_${num}_${type.toUpperCase()}${variant ? '_' + variant.toUpperCase() : ''}`;

  const setup = {
    id: uid(),
    setupId,
    type,
    variant,
    createdAt: Date.now(),
    params: { ...params },  // fl, camToChar, charToWall, camHeight, stageFL, notes
    screenshots: [],
  };
  session.setups.push(setup);
  save(data);
  return setup;
}

export function updateSetup(projectId, sessionId, setupUid, params) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  const session = project.sessions.find(s => s.id === sessionId);
  if (!session) return;
  const setup = session.setups.find(s => s.id === setupUid);
  if (!setup) return;
  setup.params = { ...setup.params, ...params };
  save(data);
}

export function getSetups(projectId, sessionId) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return [];
  const session = project.sessions.find(s => s.id === sessionId);
  return session ? session.setups : [];
}

export function deleteSetup(projectId, sessionId, setupUid) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  const session = project.sessions.find(s => s.id === sessionId);
  if (!session) return;
  session.setups = session.setups.filter(s => s.id !== setupUid);
  save(data);
}

// ── SCREENSHOT SAVE ──────────────────────────────────────────────────────────
export function saveScreenshot(projectId, sessionId, setupUid, dataUrl, meta) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  const session = project.sessions.find(s => s.id === sessionId);
  if (!session) return;
  const record = { id: uid(), dataUrl, meta, createdAt: Date.now() };
  if (setupUid) {
    const setup = session.setups.find(s => s.id === setupUid);
    if (setup) setup.screenshots.push(record);
  } else {
    session.screenshots.push(record);
  }
  save(data);
  return record;
}

// ── ACTIVE STATE (current project/session/setup in use) ──────────────────────
const STATE_KEY = 'vp_planner_state';

export function getActiveState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function setActiveState(patch) {
  const current = getActiveState();
  const next = { ...current, ...patch };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function clearActiveState() {
  try { localStorage.removeItem(STATE_KEY); } catch {}
}

// ── EXPORT DATA ───────────────────────────────────────────────────────────────
export function exportProjectJSON(projectId) {
  const data = load();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return null;
  return JSON.stringify(project, null, 2);
}
