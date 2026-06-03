const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

function getDbFilePath() {
  if (process.env.DB_FILE) {
    return path.resolve(process.env.DB_FILE);
  }
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.resolve('/tmp/olio-users.json');
  }
  return path.resolve(__dirname, '../data/users.json');
}

const DB_FILE = getDbFilePath();

async function ensureDataPath() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
}

async function readDB() {
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

async function writeDB(data) {
  await ensureDataPath();
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

module.exports = {
  readDB,
  writeDB,
  normalizeEmail,
  hashPassword,
  createSalt,
  createToken,
};
