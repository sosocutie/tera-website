const crypto = require('crypto');

const COOKIE_NAME = 'tera_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function parseJsonBody(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;

  try {
    return JSON.parse(body);
  } catch (error) {
    return {};
  }
}

function parseCookies(header = '') {
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;

      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || '').trim();
}

function getSessionSecret() {
  return String(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '').trim();
}

function signSessionPayload(expiresAt) {
  const secret = getSessionSecret();

  if (!secret) {
    return '';
  }

  return crypto
    .createHmac('sha256', secret)
    .update(`tera-admin:${expiresAt}`)
    .digest('hex');
}

function createSessionValue() {
  const expiresAt = Date.now() + (SESSION_TTL_SECONDS * 1000);
  const signature = signSessionPayload(expiresAt);
  return `${expiresAt}.${signature}`;
}

function validateSession(value) {
  if (!value) return false;

  const [expiresAtRaw, signature = ''] = String(value).split('.');
  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expectedSignature = signSessionPayload(expiresAt);

  if (!expectedSignature) {
    return false;
  }

  return timingSafeEqualString(signature, expectedSignature);
}

function setJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function buildSessionCookie(value, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];

  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function clearSessionCookie() {
  return buildSessionCookie('', 0);
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return validateSession(cookies[COOKIE_NAME]);
}

function requireAuth(req, res) {
  if (isAuthenticated(req)) {
    return true;
  }

  setJson(res, 401, {
    ok: false,
    error: 'Unauthorized'
  });

  return false;
}

module.exports = {
  SESSION_TTL_SECONDS,
  buildSessionCookie,
  clearSessionCookie,
  createSessionValue,
  getAdminPassword,
  isAuthenticated,
  parseJsonBody,
  requireAuth,
  setJson,
  timingSafeEqualString
};
