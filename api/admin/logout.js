const { clearSessionCookie, setJson } = require('../_admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return setJson(res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
  }

  res.setHeader('Set-Cookie', clearSessionCookie());

  return setJson(res, 200, {
    ok: true
  });
};
