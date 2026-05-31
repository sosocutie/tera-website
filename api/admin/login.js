const {
  SESSION_TTL_SECONDS,
  buildSessionCookie,
  createSessionValue,
  getAdminPassword,
  parseJsonBody,
  setJson,
  timingSafeEqualString
} = require('../_admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return setJson(res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
  }

  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return setJson(res, 503, {
      ok: false,
      error: 'ADMIN_PASSWORD is not configured'
    });
  }

  const body = parseJsonBody(req.body);
  const password = String(body.password || '');

  if (!timingSafeEqualString(password, adminPassword)) {
    return setJson(res, 401, {
      ok: false,
      error: 'Invalid password'
    });
  }

  res.setHeader('Set-Cookie', buildSessionCookie(createSessionValue(), SESSION_TTL_SECONDS));

  return setJson(res, 200, {
    ok: true
  });
};
