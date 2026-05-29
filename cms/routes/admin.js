const express              = require('express');
const router               = express.Router();
const { requireAuth, requirePermission, requireAdmin } = require('../middleware/auth');
const CategoryController   = require('../controllers/categoryController');
const TermController       = require('../controllers/termController');
const FieldGroupController = require('../controllers/fieldGroupController');
const MenuController       = require('../controllers/menuController');
const db                   = require('../db');
const SiteSetting          = require('../models/SiteSetting');
const Role                 = require('../models/Role');
const PostType             = require('../models/PostType');

// Proteger tudo excepto login/register/logout
router.use(function(req, res, next) {
  const pub = ['/login', '/register', '/logout'];
  if (pub.some(p => req.path.startsWith(p))) return next();
  requireAuth(req, res, next);
});

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
router.get('/', async function(req, res) {
  const authorFilter = req.user.ownContentOnly ? ' AND post_author = ?' : '';
  const authorParam  = req.user.ownContentOnly ? [req.user.id] : [];

  const [postPt, pagePt] = await Promise.all([
    PostType.findByName('post'),
    PostType.findByName('page')
  ]);
  const sysPostName = postPt.name;
  const sysPageName = pagePt.name;

  const [[pub]]   = await db.query(`SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status='publish'${authorFilter}`, [sysPostName, ...authorParam]);
  const [[draft]] = await db.query(`SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status='draft'${authorFilter}`,   [sysPostName, ...authorParam]);
  const [[pages]] = await db.query(`SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status='publish'${authorFilter}`, [sysPageName, ...authorParam]);
  const [[users]] = await db.query("SELECT COUNT(*) c FROM registers");
  const [recent]  = await db.query(
    `SELECT ID,post_title,post_name,post_status,post_date FROM wp_posts WHERE post_type=? AND post_status NOT IN ('auto-draft','revision')${authorFilter} ORDER BY post_date DESC LIMIT 6`,
    [sysPostName, ...authorParam]
  );
  res.render('admin/dashboard', {
    pageTitle: 'Dashboard', currentPage: 'dashboard',
    stats: { publishedPosts: pub.c, draftPosts: draft.c, publishedPages: pages.c, totalUsers: users.c },
    recentPosts: recent,
    postPt, pagePt
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
    req.session.user = { ...req.session.user, username: username.trim(), email: email.trim() };
    res.flash('success', 'Perfil atualizado.');
    res.redirect('/admin/profile');
  } catch (err) {
    res.render('admin/profile', { pageTitle: 'O Meu Perfil', error: err.message });
  }
});

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get('/categories',             requirePermission('categories.read'),  CategoryController.list);
router.get('/categories/new',         requirePermission('categories.write'), CategoryController.newForm);
router.post('/categories',            requirePermission('categories.write'), CategoryController.create);
router.get('/categories/:id/edit',    requirePermission('categories.write'), CategoryController.editForm);
router.post('/categories/:id',        requirePermission('categories.write'), CategoryController.update);
router.post('/categories/:id/delete', requirePermission('categories.write'), CategoryController.destroy);

// ── TERMS ─────────────────────────────────────────────────────────────────────
router.get('/terms',              requirePermission('terms.read'),  TermController.list);
router.get('/terms/new',          requirePermission('terms.write'), TermController.newForm);
router.post('/terms',             requirePermission('terms.write'), TermController.create);
router.get('/terms/:id/edit',     requirePermission('terms.write'), TermController.editForm);
router.post('/terms/:id',         requirePermission('terms.write'), TermController.update);
router.post('/terms/:id/delete',  requirePermission('terms.write'), TermController.destroy);

// ── MENUS ─────────────────────────────────────────────────────────────────────
router.get('/menus',                                    requirePermission('menus.read'),  MenuController.list);
router.get('/menus/new',                                requirePermission('menus.write'), MenuController.newForm);
router.post('/menus',                                   requirePermission('menus.write'), MenuController.create);
router.get('/menus/:id/edit',                           requirePermission('menus.write'), MenuController.editForm);
router.post('/menus/:id',                               requirePermission('menus.write'), MenuController.update);
router.post('/menus/:id/delete',                        requirePermission('menus.write'), MenuController.destroy);
router.post('/menus/:id/items',                         requirePermission('menus.write'), MenuController.addItems);
router.post('/menus/:id/reorder',                       requirePermission('menus.write'), MenuController.reorder);
router.post('/menus/:id/items/:itemId/indent',          requirePermission('menus.write'), MenuController.indentItem);
router.post('/menus/:id/items/:itemId/outdent',         requirePermission('menus.write'), MenuController.outdentItem);
router.post('/menus/:id/items/:itemId/delete',          requirePermission('menus.write'), MenuController.deleteItem);
router.post('/menus/:id/locations',                     requirePermission('menus.write'), MenuController.saveLocations);
router.post('/menus/locations/new',                     requirePermission('menus.write'), MenuController.createLocation);
router.post('/menus/locations/:key/delete',             requirePermission('menus.write'), MenuController.deleteLocation);
router.post('/menus/:id/items/:itemId',                 requirePermission('menus.write'), MenuController.updateItem);

// ── CUSTOM FIELDS ─────────────────────────────────────────────────────────────
router.get('/field-groups',                               requirePermission('field-groups.read'),  FieldGroupController.list);
router.get('/field-groups/new',                           requirePermission('field-groups.write'), FieldGroupController.newForm);
router.post('/field-groups',                              requirePermission('field-groups.write'), FieldGroupController.create);
router.get('/field-groups/:id/edit',                      requirePermission('field-groups.write'), FieldGroupController.editForm);
router.post('/field-groups/:id',                          requirePermission('field-groups.write'), FieldGroupController.update);
router.post('/field-groups/:id/delete',                   requirePermission('field-groups.write'), FieldGroupController.destroy);
router.post('/field-groups/:id/fields',                   requirePermission('field-groups.write'), FieldGroupController.addField);
router.post('/field-groups/:id/fields/:fieldId',          requirePermission('field-groups.write'), FieldGroupController.updateField);
router.post('/field-groups/:id/fields/:fieldId/delete',   requirePermission('field-groups.write'), FieldGroupController.deleteField);

// ── DEFINIÇÕES GERAIS ─────────────────────────────────────────────────────────
router.get('/settings', requirePermission('settings.read'), async function(req, res) {
  const settings = await SiteSetting.getAll();
  res.render('admin/settings', { pageTitle: 'Definições Gerais', currentPage: 'settings', settings });
});

router.post('/settings', requirePermission('settings.write'), async function(req, res) {
  const map = {
    site_title:               req.body.site_title               || null,
    site_description:         req.body.site_description         || null,
    site_logo:                req.body.site_logo                || null,
    site_icon:                req.body.site_icon                || null,
    search_engine_visibility: req.body.search_engine_visibility === '1' ? '1' : '0'
  };
  try {
    await SiteSetting.setMany(map);
    res.flash('success', 'Definições guardadas.');
  } catch (e) { res.flash('error', e.message); }
  res.redirect('/admin/settings');
});

// ── USERS ─────────────────────────────────────────────────────────────────────
router.get('/users/new', requirePermission('users.write'), async function(req, res) {
  const roles = await Role.findAll();
  res.render('admin/user-form', {
    pageTitle: 'Novo Utilizador', currentPage: 'users',
    isEdit: false, editUser: null, error: null, roles
  });
});

router.get('/users/:id/edit', requirePermission('users.write'), async function(req, res) {
  const [[user]] = await db.query('SELECT id,username,email,role FROM registers WHERE id=?', [req.params.id]);
  if (!user) return res.redirect('/admin/users');
  const roles = await Role.findAll();
  res.render('admin/user-form', {
    pageTitle: 'Editar Utilizador', currentPage: 'users',
    isEdit: true, editUser: user, error: null, roles
  });
});

router.get('/users', requirePermission('users.read'), async function(req, res) {
  const [users] = await db.query('SELECT id,username,email,role,authProvider,createdAt FROM registers ORDER BY createdAt DESC');
  const roles   = await Role.findAll();
  res.render('admin/users', { pageTitle: 'Utilizadores', currentPage: 'users', users, currentUser: req.user, roles });
});

router.post('/users', requirePermission('users.write'), async function(req, res) {
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

router.post('/users/:id', requirePermission('users.write'), async function(req, res) {
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

router.post('/users/:id/delete', requirePermission('users.write'), async function(req, res) {
  if (parseInt(req.params.id) !== req.user.id) {
    await db.query('DELETE FROM registers WHERE id=?', [req.params.id]);
    res.flash('success', 'Utilizador apagado.');
  } else {
    res.flash('error', 'Não podes apagar a tua própria conta.');
  }
  res.redirect('/admin/users');
});

// ── ROLES / FUNÇÕES ───────────────────────────────────────────────────────────
router.get('/roles', requirePermission('roles.read'), async function(req, res) {
  const roles = await Role.findAll();
  res.render('admin/roles/index', { pageTitle: 'Funções', currentPage: 'roles', roles, permissionGroups: await buildPermissionGroups() });
});

router.get('/roles/new', requirePermission('roles.write'), async function(req, res) {
  const customPostTypes = await PostType.findAll();
  res.render('admin/roles/form', {
    pageTitle: 'Nova Função', currentPage: 'roles',
    isEdit: false, role: null, error: null,
    permissionGroups: await buildPermissionGroups(), customPostTypes
  });
});

router.post('/roles', requirePermission('roles.write'), async function(req, res) {
  const { label, name } = req.body;
  const perms = [].concat(req.body.perms || []).filter(Boolean);
  const customPostTypes = await PostType.findAll();
  if (!label?.trim()) {
    return res.render('admin/roles/form', {
      pageTitle: 'Nova Função', currentPage: 'roles',
      isEdit: false, role: req.body, error: 'O label é obrigatório.',
      permissionGroups: await buildPermissionGroups(), customPostTypes
    });
  }
  try {
    await Role.create({ name: name?.trim() || slugify(label), label: label.trim(), permissions: perms, ownContentOnly: !!req.body.own_content_only });
    res.flash('success', 'Função criada.');
    res.redirect('/admin/roles');
  } catch (err) {
    res.render('admin/roles/form', {
      pageTitle: 'Nova Função', currentPage: 'roles',
      isEdit: false, role: req.body, error: err.message,
      permissionGroups: await buildPermissionGroups(), customPostTypes
    });
  }
});

router.get('/roles/:name/edit', requirePermission('roles.write'), async function(req, res) {
  const role = await Role.findByName(req.params.name);
  if (!role) return res.redirect('/admin/roles');
  const customPostTypes = await PostType.findAll();
  res.render('admin/roles/form', {
    pageTitle: 'Editar Função', currentPage: 'roles',
    isEdit: true, role, error: null,
    permissionGroups: await buildPermissionGroups(), customPostTypes
  });
});

router.post('/roles/:name', requirePermission('roles.write'), async function(req, res) {
  const { label } = req.body;
  const roleName = req.params.name;
  const role = await Role.findByName(roleName);
  if (!role) return res.redirect('/admin/roles');
  const perms = [].concat(req.body.perms || []).filter(Boolean);
  try {
    if (label?.trim()) await Role.updateLabel(roleName, label.trim());
    if (roleName !== 'admin') {
      await Role.updatePermissions(roleName, perms);
      await Role.updateOwnContentOnly(roleName, !!req.body.own_content_only);
    }
    res.flash('success', 'Função atualizada.');
    res.redirect('/admin/roles');
  } catch (err) {
    res.flash('error', err.message);
    res.redirect(`/admin/roles/${roleName}/edit`);
  }
});

router.post('/roles/:name/delete', requirePermission('roles.write'), async function(req, res) {
  const role = await Role.findByName(req.params.name);
  if (!role || role.is_system) {
    res.flash('error', 'Funções de sistema não podem ser eliminadas.');
    return res.redirect('/admin/roles');
  }
  await Role.delete(req.params.name);
  res.flash('success', 'Função eliminada. Utilizadores afetados passaram a Subscritor.');
  res.redirect('/admin/roles');
});

async function buildPermissionGroups() {
  const [postPt, pagePt] = await Promise.all([
    PostType.findByName('post'),
    PostType.findByName('page')
  ]);
  return Role.PERMISSION_GROUPS.map(g => {
    if (g.key !== 'content') return g;
    return { ...g, items: g.items.map(item => {
      if (item.key === 'posts') return { ...item, label: postPt.label };
      if (item.key === 'pages') return { ...item, label: pagePt.label };
      return item;
    })};
  });
}

function slugify(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

module.exports = router;
