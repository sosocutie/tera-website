const { isAuthenticated, setJson } = require('../_admin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return setJson(res, 405, {
      ok: false,
      error: 'Method not allowed'
    });
  }

  return setJson(res, 200, {
    ok: true,
    authenticated: isAuthenticated(req)
  });
};
