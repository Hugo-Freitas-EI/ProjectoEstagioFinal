const jwt = require('jsonwebtoken');

// Verifica autenticação; bloqueia subscritores fora do frontend
function requireAuth(req, res, next) {
  const token = req.session?.token || req.cookies?.token;
  if (!token) return res.redirect('/admin/login');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (req.user.role === 'subscriber') return res.redirect('/');
    next();
  } catch {
    req.session.destroy();
    res.clearCookie('token');
    return res.redirect('/admin/login');
  }
}

// Apenas administradores (Estrutura + Gestão)
function requireAdmin(req, res, next) {
  requireAuth(req, res, function() {
    if (req.user.role !== 'admin') {
      return res.status(403).render('frontend/error', {
        pageTitle: 'Sem permissão',
        message: 'Apenas administradores podem aceder a esta secção.',
        navPages: []
      });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
