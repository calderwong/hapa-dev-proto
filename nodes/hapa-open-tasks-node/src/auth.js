export function normalizeToken(t) {
  if (!t) return '';
  return String(t).trim().replace(/^Bearer\s+/i, '');
}

export function getRequestToken(req, { allowQueryToken }) {
  const header = req.headers?.authorization;
  if (header) return normalizeToken(header);

  if (allowQueryToken) {
    const q = req.query?.token;
    if (q) return normalizeToken(q);
  }

  return '';
}

export function requireBearerToken(req, reply, { token, allowQueryToken }) {
  const provided = getRequestToken(req, { allowQueryToken });
  if (!provided || provided !== token) {
    reply.code(401).send({ ok: false, error: 'UNAUTHORIZED' });
    return false;
  }
  return true;
}
