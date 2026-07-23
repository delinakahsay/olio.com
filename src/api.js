async function parseJson(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('Server error: ' + text);
  }
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

export function search(query) {
  return fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  }).then(parseJson);
}

export function auth(payload) {
  return fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(parseJson);
}

export function getProfile(token) {
  return fetch('/api/profile', {
    headers: { authorization: 'Bearer ' + token },
  }).then(parseJson);
}

export function profileAction(token, action, data) {
  return fetch('/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ action, ...data }),
  }).then(parseJson);
}
