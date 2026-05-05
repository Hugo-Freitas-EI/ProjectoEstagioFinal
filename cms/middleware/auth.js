const jwt  = require('jsonwebtoken');
const db   = require('../db');
const Role = require('../models/Role');

const DENY = (res) => res.status(403).render('frontend/error', {
  pageTitle: 'Sem permissão',
  message: 'Não tens permissão para aceder a esta secção.',
  navPages: []
});

// Verifica autenticação e carrega role + permissões frescos da BD
async function requireAuth(req, res, next) {
  const token = req.session?.token || req.cookies?.token;
  if (!token) return res.redirect('/admin/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [[dbUser]] = await db.query(
      'SELECT id, username, email, role FROM registers WHERE id = ?', [decoded.id]
    );
    if (!dbUser) {
      req.session.destroy();
      res.clearCookie('token');
      return res.redirect('/admin/login');
    }
    dbUser.permissions = dbUser.role === 'admin'
      ? Role.ALL_PERMISSION_KEYS
      : await Role.getPermissions(dbUser.role);
    let roleLabel = dbUser.role, ownContentOnly = false;
    try {
      const [[roleRow]] = await db.query('SELECT label, own_content_only FROM roles WHERE name = ?', [dbUser.role]);
      roleLabel      = roleRow ? roleRow.label : dbUser.role;
      ownContentOnly = roleRow ? !!roleRow.own_content_only : false;
    } catch {
      const [[roleRow]] = await db.query('SELECT label FROM roles WHERE name = ?', [dbUser.role]);
      roleLabel = roleRow ? roleRow.label : dbUser.role;
    }
    dbUser.roleLabel      = roleLabel;
    dbUser.ownContentOnly = ownContentOnly;

    req.user          = dbUser;
    req.session.user  = dbUser;
    res.locals.user   = dbUser; // atualizar para o pedido atual

    if (dbUser.role === 'subscriber') return res.redirect('/');
    next();
  } catch {
    req.session.destroy();
    res.clearCookie('token');
    return res.redirect('/admin/login');
  }
}

// Fábrica: cria middleware que exige uma permissão específica
function requirePermission(permission) {
  return function(req, res, next) {
    if (!req.user) return res.redirect('/admin/login');
    if (req.user.role === 'admin') return next();
    const perms = req.user.permissions || [];
    if (perms.includes(permission)) return next();
    // write implica read: se o utilizador tem X.write, passa também em X.read
    if (permission.endsWith('.read') && perms.includes(permission.replace('.read', '.write'))) return next();
    return DENY(res);
  };
}

// Atalho: só admins (mantido para compatibilidade)
function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect('/admin/login');
  if (req.user.role === 'admin') return next();
  return DENY(res);
}

module.exports = { requireAuth, requireAdmin, requirePermission };
