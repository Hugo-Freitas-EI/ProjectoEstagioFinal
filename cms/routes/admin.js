const express              = require('express');
const router               = express.Router();
const { requireAuth }      = require('../middleware/auth');
const CategoryController   = require('../controllers/categoryController');
const TermController       = require('../controllers/termController');
const FieldGroupController = require('../controllers/fieldGroupController');
const db                   = require('../db');

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

// ── CUSTOM FIELDS ─────────────────────────────────────────────────────────────
router.get('/field-groups',                               FieldGroupController.list);
router.get('/field-groups/new',                           FieldGroupController.newForm);
router.post('/field-groups',                              FieldGroupController.create);
router.get('/field-groups/:id/edit',                      FieldGroupController.editForm);
router.post('/field-groups/:id',                          FieldGroupController.update);
router.post('/field-groups/:id/delete',                   FieldGroupController.destroy);
router.post('/field-groups/:id/fields',                   FieldGroupController.addField);
router.post('/field-groups/:id/fields/:fieldId',          FieldGroupController.updateField);
router.post('/field-groups/:id/fields/:fieldId/delete',   FieldGroupController.deleteField);


// ── USERS ─────────────────────────────────────────────────────────────────────
router.get('/users', async function(req, res) {
  const [users] = await db.query('SELECT id,username,email,role,authProvider,createdAt FROM registers ORDER BY createdAt DESC');
  res.render('admin/users', { pageTitle: 'Utilizadores', currentPage: 'users', users, currentUser: req.user });
});

router.post('/users', async function(req, res) {
  const bcrypt = require('bcryptjs');
  const { username, email, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 12);
  const now = new Date();
  try {
    await db.query('INSERT INTO registers (username,email,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
      [username, email, hashed, role || 'user', now, now]);
    res.flash('success', 'Utilizador criado.');
  } catch (e) { res.flash('error', e.message); }
  res.redirect('/admin/users');
});

router.post('/users/:id', async function(req, res) {
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

router.post('/users/:id/delete', async function(req, res) {
  if (parseInt(req.params.id) !== req.user.id) {
    await db.query('DELETE FROM registers WHERE id=?', [req.params.id]);
    res.flash('success', 'Utilizador apagado.');
  } else {
    res.flash('error', 'Não podes apagar a tua própria conta.');
  }
  res.redirect('/admin/users');
});

module.exports = router;
