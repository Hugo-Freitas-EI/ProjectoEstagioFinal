const express              = require('express');
const router               = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const CategoryController   = require('../controllers/categoryController');
const TermController       = require('../controllers/termController');
const FieldGroupController = require('../controllers/fieldGroupController');
const MenuController       = require('../controllers/menuController');
const db                   = require('../db');
const SiteSetting          = require('../models/SiteSetting');

// Proteger tudo excepto login/register/logout
router.use(function(req, res, next) {
  const pub = ['/login', '/register', '/logout'];
  if (pub.some(p => req.path.startsWith(p))) return next();
  requireAuth(req, res, next);
});

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
router.get('/', async function(req, res) {
  const [[pub]]   = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type='post' AND post_status='publish'");
  const [[draft]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type='post' AND post_status='draft'");
  const [[pages]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type='page' AND post_status='publish'");
  const [[users]] = await db.query("SELECT COUNT(*) c FROM registers");
  const [recent]  = await db.query("SELECT ID,post_title,post_name,post_status,post_date FROM wp_posts WHERE post_type='post' AND post_status NOT IN ('auto-draft','revision') ORDER BY post_date DESC LIMIT 6");
  res.render('admin/dashboard', {
    pageTitle: 'Dashboard', currentPage: 'dashboard',
    stats: { publishedPosts: pub.c, draftPosts: draft.c, publishedPages: pages.c, totalUsers: users.c },
    recentPosts: recent
  });
});

// ── PERFIL (qualquer utilizador autenticado) ──────────────────────────────────
router.get('/profile', function(req, res) {
  res.render('admin/profile', { pageTitle: 'O Meu Perfil', error: null });
});

router.post('/profile', async function(req, res) {
  const bcrypt = require('bcryptjs');
  const { username, email, password } = req.body;
  if (!username?.trim() || !email?.trim()) {
    return res.render('admin/profile', { pageTitle: 'O Meu Perfil', error: 'Nome e email são obrigatórios.' });
  }
  const now = new Date();
  const fields = ['username=?', 'email=?', 'updatedAt=?'];
  const vals   = [username.trim(), email.trim(), now];
  if (password) {
    fields.push('password=?');
    vals.push(await bcrypt.hash(password, 12));
  }
  vals.push(req.user.id);
  try {
    await db.query('UPDATE registers SET ' + fields.join(',') + ' WHERE id=?', vals);
    // Atualizar a sessão com os novos dados
    req.session.user = { ...req.session.user, username: username.trim(), email: email.trim() };
    res.flash('success', 'Perfil atualizado.');
    res.redirect('/admin/profile');
  } catch (err) {
    res.render('admin/profile', { pageTitle: 'O Meu Perfil', error: err.message });
  }
});

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get('/categories',             CategoryController.list);
router.get('/categories/new',         CategoryController.newForm);
router.post('/categories',            CategoryController.create);
router.get('/categories/:id/edit',    CategoryController.editForm);
router.post('/categories/:id',        CategoryController.update);
router.post('/categories/:id/delete', CategoryController.destroy);

// ── TERMS ─────────────────────────────────────────────────────────────────────
router.get('/terms',              TermController.list);
router.get('/terms/new',          TermController.newForm);
router.post('/terms',             TermController.create);
router.get('/terms/:id/edit',     TermController.editForm);
router.post('/terms/:id',         TermController.update);
router.post('/terms/:id/delete',  TermController.destroy);

// ── MENUS ─────────────────────────────────────────────────────────────────────
router.get('/menus',                                    MenuController.list);
router.get('/menus/new',                                MenuController.newForm);
router.post('/menus',                                   MenuController.create);
router.get('/menus/:id/edit',                           MenuController.editForm);
router.post('/menus/:id',                               MenuController.update);
router.post('/menus/:id/delete',                        MenuController.destroy);
router.post('/menus/:id/items',                         MenuController.addItems);
router.post('/menus/:id/reorder',                       MenuController.reorder);
router.post('/menus/:id/items/:itemId/indent',          MenuController.indentItem);
router.post('/menus/:id/items/:itemId/outdent',         MenuController.outdentItem);
router.post('/menus/:id/items/:itemId/delete',          MenuController.deleteItem);
router.post('/menus/:id/locations',                     MenuController.saveLocations);
router.post('/menus/:id/items/:itemId',                 MenuController.updateItem);

// ── CUSTOM FIELDS (só admin) ──────────────────────────────────────────────────
router.get('/field-groups',                               requireAdmin, FieldGroupController.list);
router.get('/field-groups/new',                           requireAdmin, FieldGroupController.newForm);
router.post('/field-groups',                              requireAdmin, FieldGroupController.create);
router.get('/field-groups/:id/edit',                      requireAdmin, FieldGroupController.editForm);
router.post('/field-groups/:id',                          requireAdmin, FieldGroupController.update);
router.post('/field-groups/:id/delete',                   requireAdmin, FieldGroupController.destroy);
router.post('/field-groups/:id/fields',                   requireAdmin, FieldGroupController.addField);
router.post('/field-groups/:id/fields/:fieldId',          requireAdmin, FieldGroupController.updateField);
router.post('/field-groups/:id/fields/:fieldId/delete',   requireAdmin, FieldGroupController.deleteField);


// ── DEFINIÇÕES GERAIS (só admin) ──────────────────────────────────────────────
router.get('/settings', requireAdmin, async function(req, res) {
  const settings = await SiteSetting.getAll();
  res.render('admin/settings', {
    pageTitle: 'Definições Gerais',
    currentPage: 'settings',
    settings
  });
});

router.post('/settings', requireAdmin, async function(req, res) {
  const map = {
    site_title:                 req.body.site_title                || null,
    site_description:           req.body.site_description          || null,
    site_icon:                  req.body.site_icon                 || null,
    // checkbox: presente = '1', ausente = '0'
    search_engine_visibility:   req.body.search_engine_visibility === '1' ? '1' : '0'
  };

  try {
    await SiteSetting.setMany(map);
    res.flash('success', 'Definições guardadas.');
  } catch (e) {
    res.flash('error', e.message);
  }
  res.redirect('/admin/settings');
});

// ── USERS (só admin) ──────────────────────────────────────────────────────────
router.get('/users/new', requireAdmin, function(req, res) {
  res.render('admin/user-form', {
    pageTitle: 'Novo Utilizador', currentPage: 'users',
    isEdit: false, editUser: null, error: null
  });
});

router.get('/users/:id/edit', requireAdmin, async function(req, res) {
  const [[user]] = await db.query(
    'SELECT id, username, email, role FROM registers WHERE id = ?', [req.params.id]
  );
  if (!user) return res.redirect('/admin/users');
  res.render('admin/user-form', {
    pageTitle: 'Editar Utilizador', currentPage: 'users',
    isEdit: true, editUser: user, error: null
  });
});

router.get('/users', requireAdmin, async function(req, res) {
  const [users] = await db.query('SELECT id,username,email,role,authProvider,createdAt FROM registers ORDER BY createdAt DESC');
  res.render('admin/users', { pageTitle: 'Utilizadores', currentPage: 'users', users, currentUser: req.user });
});

router.post('/users', requireAdmin, async function(req, res) {
  const bcrypt = require('bcryptjs');
  const { username, email, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 12);
  const now = new Date();
  try {
    await db.query('INSERT INTO registers (username,email,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
      [username, email, hashed, role || 'subscriber', now, now]);
    res.flash('success', 'Utilizador criado.');
  } catch (e) { res.flash('error', e.message); }
  res.redirect('/admin/users');
});

router.post('/users/:id', requireAdmin, async function(req, res) {
  const bcrypt = require('bcryptjs');
  const { username, email, role, password } = req.body;
  const now = new Date();
  const fields = ['username=?', 'email=?', 'role=?', 'updatedAt=?'];
  const vals = [username, email, role, now];
  if (password) { fields.push('password=?'); vals.push(await bcrypt.hash(password, 12)); }
  vals.push(req.params.id);
  await db.query('UPDATE registers SET ' + fields.join(',') + ' WHERE id=?', vals);
  res.flash('success', 'Utilizador atualizado.');
  res.redirect('/admin/users');
});

router.post('/users/:id/delete', requireAdmin, async function(req, res) {
  if (parseInt(req.params.id) !== req.user.id) {
    await db.query('DELETE FROM registers WHERE id=?', [req.params.id]);
    res.flash('success', 'Utilizador apagado.');
  } else {
    res.flash('error', 'Não podes apagar a tua própria conta.');
  }
  res.redirect('/admin/users');
});

module.exports = router;
