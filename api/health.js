// Diagnostics for the storage layer. Reports whether configuration is present
// and whether the database actually answers. Never returns a secret value:
// only booleans, lengths, and the host portion of the URL.
const db = require('./db');

module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

  let host = null;
  let urlParses = false;
  try {
    host = new URL(url).host;
    urlParses = true;
  } catch (e) {
    urlParses = false;
  }

  const out = {
    usingSupabase: db.USE_SUPABASE,
    urlPresent: Boolean(url),
    urlLength: url.length,
    urlParses,
    urlHost: host,
    urlHasTrailingSlash: url.endsWith('/'),
    urlHasWhitespace: url !== url.trim(),
    keyPresent: Boolean(key),
    keyLength: key.length,
    keyHasWhitespace: key !== key.trim(),
    // The prefix is a type label, not the secret. Which type matters: a
    // publishable key is subject to RLS and would return empty results from
    // every query rather than an error, which looks exactly like an empty
    // database. A secret or service_role key bypasses RLS, which is what the
    // server needs.
    keyKind: key.startsWith('sb_secret_')
      ? 'secret (correct)'
      : key.startsWith('sb_publishable_')
        ? 'publishable (WRONG: subject to RLS, will read as empty)'
        : key.split('.').length === 3
          ? 'legacy jwt (check it is service_role, not anon)'
          : 'unrecognized',
    nodeEnv: process.env.NODE_ENV || null,
  };

  // A real round trip. This is the only thing that proves the credentials work.
  if (db.USE_SUPABASE) {
    for (const table of ['users', 'sessions']) {
      try {
        const rows = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=id&limit=1`, {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
          },
        });
        const body = await rows.text();
        out[`${table}Reachable`] = rows.ok;
        out[`${table}Status`] = rows.status;
        if (!rows.ok) out[`${table}Error`] = body.slice(0, 300);
      } catch (err) {
        out[`${table}Reachable`] = false;
        out[`${table}Error`] = String(err.message).slice(0, 300);
      }
    }
  }

  res.setHeader('cache-control', 'no-store');
  return res.status(200).json(out);
};
