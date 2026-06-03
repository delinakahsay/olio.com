const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const LOCAL_DB_FILE = path.resolve(__dirname, '../data/users.json');
const PROD_LOCAL_DB_FILE = path.resolve('/tmp/olio-users.json');
const DB_FILE = USE_SUPABASE ? null : (process.env.NODE_ENV === 'production' ? PROD_LOCAL_DB_FILE : LOCAL_DB_FILE);

async function ensureLocalDataPath() {
  if (!DB_FILE) return;
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
}

async function readLocalDB() {
  await ensureLocalDataPath();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { users: [] };
    }
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
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON from Supabase: ${text}`);
  }
}

function normalizeSupabaseUser(row) {
  if (!row) return null;
  return {
    id: row.id || row.ID || row.Id || null,
    email: row.email || row.EMAIL || null,
    passwordHash: row.passwordHash || row.passwordhash || row.password_hash || null,
    salt: row.salt || row.SALT || null,
    token: row.token || row.TOKEN || null,
    savedItems: row.savedItems || row.saveditems || row.saved_items || [],
    orders: row.orders || row.ORDERS || row.order || row.orders || [],
    createdAt: row.createdAt || row.createdat || row.created_at || null,
  };
}

function supabasePayload(user) {
  const payload = {};
  if (user.id !== undefined) payload.id = user.id;
  if (user.email !== undefined) payload.email = user.email;
  if (user.passwordHash !== undefined) payload.passwordhash = user.passwordHash;
  if (user.salt !== undefined) payload.salt = user.salt;
  if (user.token !== undefined) payload.token = user.token;
  if (user.savedItems !== undefined) payload.saveditems = user.savedItems;
  if (user.orders !== undefined) payload.orders = user.orders;
  if (user.createdAt !== undefined) payload.createdat = user.createdAt;
  return payload;
}

async function supabaseGetUserByEmail(email) {
  const rows = await supabaseFetch(`users?email=eq.${encodeURIComponent(email)}&select=*`, {
    method: 'GET',
  });
  const row = Array.isArray(rows) ? rows[0] || null : null;
  return normalizeSupabaseUser(row);
}

async function supabaseGetUserByToken(token) {
  const rows = await supabaseFetch(`users?token=eq.${encodeURIComponent(token)}&select=*`, {
    method: 'GET',
  });
  const row = Array.isArray(rows) ? rows[0] || null : null;
  return normalizeSupabaseUser(row);
}

async function supabaseCreateUser(user) {
  const payload = supabasePayload(user);
  const rows = await supabaseFetch('users?select=*', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const row = Array.isArray(rows) ? rows[0] || null : null;
  return normalizeSupabaseUser(row);
}

async function supabaseUpdateUser(id, updates) {
  const payload = supabasePayload(updates);
  const rows = await supabaseFetch(`users?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const row = Array.isArray(rows) ? rows[0] || null : null;
  return normalizeSupabaseUser(row);
}
async function getUserByEmail(email) {
  if (USE_SUPABASE) {
    return supabaseGetUserByEmail(normalizeEmail(email));
  }

  const db = await readLocalDB();
  return db.users.find((u) => u.email === normalizeEmail(email)) || null;
}

async function getUserByToken(token) {
  if (USE_SUPABASE) {
    return { user: await supabaseGetUserByToken(token) };
  }

  const db = await readLocalDB();
  const user = db.users.find((u) => u.token === token) || null;
  return { db, user };
}

async function createUser(user) {
  if (USE_SUPABASE) {
    return supabaseCreateUser(user);
  }

  const db = await readLocalDB();
  db.users.push(user);
  await writeLocalDB(db);
  return user;
}

async function updateUser(id, updates) {
  if (USE_SUPABASE) {
    return supabaseUpdateUser(id, updates);
  }

  const db = await readLocalDB();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) {
    return null;
  }
  db.users[idx] = { ...db.users[idx], ...updates };
  await writeLocalDB(db);
  return db.users[idx];
}

module.exports = {
  USE_SUPABASE,
  normalizeEmail,
  hashPassword,
  createSalt,
  createToken,
  getUserByEmail,
  getUserByToken,
  createUser,
  updateUser,
};
