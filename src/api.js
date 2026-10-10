async function parseJson(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error("Olio could not reach the server. Please try again.");
  }
  if (!res.ok) {
    const err = new Error(data.error || "Please try again.");
    err.status = res.status;
    throw err;
  }
  return data;
}

export function search(params) {
  // params: { query, category, priceMin, priceMax }
  const payload = typeof params === "string" ? { query: params } : params;
  return fetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).then(parseJson);
}

export function auth(payload) {
  return fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).then(parseJson);
}

export function getProfile(token) {
  return fetch("/api/profile", {
    headers: { authorization: "Bearer " + token },
  }).then(parseJson);
}

export function profileAction(token, action, data) {
  return fetch("/api/profile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
    },
    body: JSON.stringify({ action, ...data }),
  }).then(parseJson);
}
