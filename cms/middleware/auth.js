const jwt = require('jsonwebtoken');

// Middleware para proteger rotas do admin
function requireAuth(req, res, next) {
  const token = req.session?.token || req.cookies?.token;

  if (!token) {
    return res.redirect('/admin/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    req.session.destroy();
    res.clearCookie('token');
    return res.redirect('/admin/login');
  }
}

// Middleware que verifica se é admin/editor
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!['admin', 'editor'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
