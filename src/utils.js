export function isValidHttpUrl(s) {
  try {
    if (!s) return false;
    const u = new URL(String(s).trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

export function fallbackSearchLink(title) {
  return 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(title || 'product');
}
