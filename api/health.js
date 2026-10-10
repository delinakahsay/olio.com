// Storage diagnostics.
//
// This endpoint is public, so a healthy system says nothing but "ok". Detail
// appears only when something is actually wrong, which is the only time anyone
// needs it. Even then it reports shapes and booleans, never a secret value.
//
// It exists because the opposite of this endpoint cost four months: the API
// was writing every account to an ephemeral file because SUPABASE_URL was
// saved with an empty value, and nothing anywhere said so.
const db = require('./db');

function classifyKey(key) {
  if (!key) return 'missing';
  if (key.startsWith('sb_secret_')) return 'secret (correct)';
  if (key.startsWith('sb_publishable_')) {
    return 'publishable (WRONG: subject to RLS, every query reads as empty)';
  }
  if (key.split('.').length === 3) return 'legacy jwt (must be service_role, not anon)';
  return 'unrecognized';
}

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');

  const rawUrl = String(process.env.SUPABASE_URL || '');
  const key = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '').trim();

  const problems = [];
  if (!rawUrl.trim()) {
    problems.push('SUPABASE_URL is missing or empty. In Vercel, check it is in the Value field and not the Note field.');
  }
  if (!key) {
    problems.push('SUPABASE_SERVICE_KEY is missing or empty.');
  }

  // A real round trip is the only thing that proves the credentials work.
  // Reachability is checked with a HEAD-style count so no row data is read.
  if (db.USE_SUPABASE) {
    const base = rawUrl.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
    for (const table of ['users', 'sessions']) {
      try {
        const r = await fetch(`${base}/rest/v1/${table}?select=id&limit=0`, {
          headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        });
        if (!r.ok) {
          problems.push(`${table}: HTTP ${r.status} from PostgREST.`);
        }
      } catch (err) {
        problems.push(`${table}: ${String(err.message).slice(0, 200)}`);
      }
    }
  }

  if (!problems.length) {
    return res.status(200).json({ ok: true, store: 'supabase' });
  }

  return res.status(503).json({
    ok: false,
    store: db.USE_SUPABASE ? 'supabase' : 'EPHEMERAL LOCAL FILE (accounts will not persist)',
    problems,
    keyKind: classifyKey(key),
    urlLength: rawUrl.length,
    urlHasWhitespace: rawUrl !== rawUrl.trim(),
  });
};
