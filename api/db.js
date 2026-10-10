const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Accept the project URL however it was pasted. A trailing slash, or the
// /rest/v1 suffix copied from the Supabase dashboard, would otherwise produce
// a doubled path and a 404 on every single query.
function normalizeSupabaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '').trim();
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOCAL_DB_FILE = path.resolve(__dirname, '../data/users.json');

// In production there is no acceptable fallback. The old code quietly wrote
// accounts to a file in /tmp, which Vercel discards between invocations, so a
// misconfigured URL looked like "registration works, then you are mysteriously
// signed out" instead of like an error. Silence cost weeks. Fail loudly.
if (IS_PRODUCTION && !USE_SUPABASE) {
  const missing = [
    SUPABASE_URL ? null : 'SUPABASE_URL',
    SUPABASE_KEY ? null : 'SUPABASE_SERVICE_KEY',
  ].filter(Boolean);
  console.error(
    `FATAL: database is not configured. Missing or empty: ${missing.join(', ')}. ` +
      'Refusing to fall back to ephemeral local storage in production.'
  );
}

const DB_FILE = USE_SUPABASE ? null : LOCAL_DB_FILE;

// Called at the top of every storage function. In production this converts a
// silent data-loss bug into a visible 500 with a log line that names the cause.
function assertConfigured() {
  if (USE_SUPABASE) return;
  if (IS_PRODUCTION) {
    throw new Error(
      'Database is not configured: SUPABASE_URL and SUPABASE_SERVICE_KEY must both be set.'
    );
  }
}

const SESSION_DAYS = 30;

async function ensureLocalDataPath() {
  if (!DB_FILE) return;
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
}

async function readLocalDB() {
  await ensureLocalDataPath();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sessions)) data.sessions = [];
    return data;
  } catch (err) {
    if (err.code === 'ENOENT') return { users: [], sessions: [] };
    throw err;
  }
}

async function writeLocalDB(data) {
  await ensureLocalDataPath();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
  return data;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function createSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

// The session table stores only this digest, so a leaked database cannot be
// replayed as a login. The raw token exists in the client and nowhere else.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Comparing hashes with !== leaks timing. Lengths are fixed here, but guard
// anyway so a future change to the hash cannot quietly reintroduce the leak.
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPassword(password, user) {
  if (!user || !user.salt || !user.passwordHash) return false;
  return safeEqualHex(hashPassword(password, user.salt), user.passwordHash);
}

function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON from Supabase: ${text}`);
  }
}

// Column names are snake_case in the database and camelCase in the app. These
// two functions are the only place that knows both.
function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    email: row.email || null,
    name: row.name || '',
    passwordHash: row.password_hash || null,
    salt: row.salt || null,
    savedItems: row.saved_items || [],
    cart: row.cart || [],
    orders: row.orders || [],
    createdAt: row.created_at || null,
  };
}

function toRow(user) {
  const row = {};
  if (user.id !== undefined) row.id = user.id;
  if (user.email !== undefined) row.email = user.email;
  if (user.name !== undefined) row.name = user.name;
  if (user.passwordHash !== undefined) row.password_hash = user.passwordHash;
  if (user.salt !== undefined) row.salt = user.salt;
  if (user.savedItems !== undefined) row.saved_items = user.savedItems;
  if (user.cart !== undefined) row.cart = user.cart;
  if (user.orders !== undefined) row.orders = user.orders;
  if (user.createdAt !== undefined) row.created_at = user.createdAt;
  return row;
}

async function getUserByEmail(email) {
  assertConfigured();
  const normalized = normalizeEmail(email);
  if (USE_SUPABASE) {
    const rows = await supabaseFetch(`users?email=eq.${encodeURIComponent(normalized)}&select=*&limit=1`);
    return fromRow(Array.isArray(rows) ? rows[0] : null);
  }
  const db = await readLocalDB();
  return db.users.find((u) => u.email === normalized) || null;
}

async function createUser(user) {
  assertConfigured();
  if (USE_SUPABASE) {
    const rows = await supabaseFetch('users?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(toRow(user)),
    });
    return fromRow(Array.isArray(rows) ? rows[0] : null);
  }
  const db = await readLocalDB();
  db.users.push(user);
  await writeLocalDB(db);
  return user;
}

async function updateUser(id, updates) {
  assertConfigured();
  if (USE_SUPABASE) {
    const rows = await supabaseFetch(`users?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(toRow(updates)),
    });
    return fromRow(Array.isArray(rows) ? rows[0] : null);
  }
  const db = await readLocalDB();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...updates };
  await writeLocalDB(db);
  return db.users[idx];
}

// --- sessions --------------------------------------------------------------
// One row per signed-in device, so a new sign-in no longer evicts the old one.

async function createSession(userId, userAgent) {
  assertConfigured();
  const token = createToken();
  const record = {
    token_hash: hashToken(token),
    user_id: userId,
    user_agent: String(userAgent || '').slice(0, 300) || null,
    expires_at: sessionExpiry(),
  };

  if (USE_SUPABASE) {
    await supabaseFetch('sessions', { method: 'POST', body: JSON.stringify(record) });
  } else {
    const db = await readLocalDB();
    db.sessions.push({ ...record, created_at: new Date().toISOString() });
    await writeLocalDB(db);
  }
  return token;
}

async function getUserByToken(token) {
  if (!token) return { user: null };
  assertConfigured();
  const digest = hashToken(token);

  if (USE_SUPABASE) {
    // One round trip: the foreign key lets PostgREST embed the user row.
    const rows = await supabaseFetch(
      `sessions?token_hash=eq.${encodeURIComponent(digest)}&select=expires_at,users(*)&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { user: null };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await deleteSession(token);
      return { user: null };
    }
    return { user: fromRow(row.users) };
  }

  const db = await readLocalDB();
  const session = db.sessions.find((s) => s.token_hash === digest) || null;
  if (!session) return { db, user: null };
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    db.sessions = db.sessions.filter((s) => s.token_hash !== digest);
    await writeLocalDB(db);
    return { db, user: null };
  }
  return { db, user: db.users.find((u) => u.id === session.user_id) || null };
}

async function deleteSession(token) {
  assertConfigured();
  if (!token) return;
  const digest = hashToken(token);
  if (USE_SUPABASE) {
    await supabaseFetch(`sessions?token_hash=eq.${encodeURIComponent(digest)}`, { method: 'DELETE' });
    return;
  }
  const db = await readLocalDB();
  db.sessions = db.sessions.filter((s) => s.token_hash !== digest);
  await writeLocalDB(db);
}

// Used when a password changes: every other device should be signed out.
async function deleteSessionsForUser(userId, exceptToken) {
  assertConfigured();
  if (USE_SUPABASE) {
    const keep = exceptToken ? `&token_hash=neq.${encodeURIComponent(hashToken(exceptToken))}` : '';
    await supabaseFetch(`sessions?user_id=eq.${encodeURIComponent(userId)}${keep}`, { method: 'DELETE' });
    return;
  }
  const db = await readLocalDB();
  const keepHash = exceptToken ? hashToken(exceptToken) : null;
  db.sessions = db.sessions.filter((s) => s.user_id !== userId || s.token_hash === keepHash);
  await writeLocalDB(db);
}

module.exports = {
  USE_SUPABASE,
  normalizeEmail,
  hashPassword,
  verifyPassword,
  createSalt,
  createToken,
  hashToken,
  getUserByEmail,
  getUserByToken,
  createUser,
  updateUser,
  createSession,
  deleteSession,
  deleteSessionsForUser,
};
