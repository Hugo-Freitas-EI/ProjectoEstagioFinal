const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Slugify simples sem dependência
function makeSlug(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() || 'sem-titulo';
}

// Multer para upload de media
var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    var dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e5) + ext);
  }
});
var upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Proteger todas as rotas (exceto login/register/logout)
router.use(function(req, res, next) {
  var publicPaths = ['/login', '/register', '/logout'];
  if (publicPaths.some(function(p) { return req.path.startsWith(p); })) return next();
  requireAuth(req, res, next);
});

// ────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────
router.get('/', async function(req, res) {
  try {
    var [[pub]]   = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type='post' AND post_status='publish'");
    var [[draft]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type='post' AND post_status='draft'");
    var [[pages]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type='page' AND post_status='publish'");
    var [[users]] = await db.query("SELECT COUNT(*) c FROM registers");
    var [recent]  = await db.query("SELECT ID,post_title,post_name,post_status,post_date FROM wp_posts WHERE post_type='post' AND post_status!='auto-draft' ORDER BY post_date DESC LIMIT 6");
    res.render('admin/dashboard', {
      pageTitle: 'Dashboard', currentPage: 'dashboard',
      stats: { publishedPosts: pub.c, draftPosts: draft.c, publishedPages: pages.c, totalUsers: users.c },
      recentPosts: recent
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', {
      pageTitle: 'Dashboard', currentPage: 'dashboard',
      stats: { publishedPosts: 0, draftPosts: 0, publishedPages: 0, totalUsers: 0 },
      recentPosts: []
    });
  }
});

// ────────────────────────────────────────────────
// POSTS — listar
// ────────────────────────────────────────────────
router.get('/posts', async function(req, res) {
  await renderList(req, res, 'post');
});

// PAGES — listar
router.get('/pages', async function(req, res) {
  await renderList(req, res, 'page');
});

async function renderList(req, res, postType) {
  var status = req.query.status || 'all';
  var search = req.query.search || '';
  var page   = parseInt(req.query.page) || 1;
  var limit  = 20;
  var offset = (page - 1) * limit;

  var where  = ['post_type = ?'];
  var params = [postType];
  if (status !== 'all') { where.push('post_status = ?'); params.push(status); }
  else { where.push("post_status != 'auto-draft'"); }
  if (search) { where.push('post_title LIKE ?'); params.push('%' + search + '%'); }
  var wStr = where.join(' AND ');

  var [posts] = await db.query(
    'SELECT ID,post_title,post_name,post_status,post_date FROM wp_posts WHERE ' + wStr + ' ORDER BY post_date DESC LIMIT ? OFFSET ?',
    params.concat([limit, offset])
  );
  var [[ct]] = await db.query('SELECT COUNT(*) total FROM wp_posts WHERE ' + wStr, params);
  var [[ca]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status!='auto-draft'", [postType]);
  var [[cp]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status='publish'", [postType]);
  var [[cd]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status='draft'", [postType]);

  res.render('admin/posts-list', {
    pageTitle: postType === 'page' ? 'Páginas' : 'Posts',
    currentPage: postType === 'page' ? 'pages' : 'posts',
    posts, postType, status, search,
    pagination: { current: page, total: Math.ceil(ct.total / limit) },
    counts: { all: ca.c, publish: cp.c, draft: cd.c }
  });
}

// ────────────────────────────────────────────────
// POSTS — novo
// ────────────────────────────────────────────────
router.get('/posts/new', function(req, res) {
  res.render('admin/post-editor', {
    pageTitle: 'Novo Post', currentPage: 'posts',
    postType: 'post', post: null, isEdit: false,
    formAction: '/admin/posts',
    error: null
  });
});

router.get('/pages/new', function(req, res) {
  res.render('admin/post-editor', {
    pageTitle: 'Nova Página', currentPage: 'pages',
    postType: 'page', post: null, isEdit: false,
    formAction: '/admin/pages',
    error: null
  });
});

// ────────────────────────────────────────────────
// POSTS — criar (POST)
// ────────────────────────────────────────────────
router.post('/posts', async function(req, res) {
  await createPost(req, res, 'post');
});
router.post('/pages', async function(req, res) {
  await createPost(req, res, 'page');
});

async function createPost(req, res, postType) {
  var title    = (req.body.post_title || '').trim();
  var content  = req.body.post_content || '';
  var excerpt  = req.body.post_excerpt || '';
  var slug     = (req.body.post_name || makeSlug(title)).trim() || makeSlug(title);
  var action   = req.body.action || 'draft';
  var status   = action === 'publish' ? 'publish' : 'draft';
  var date     = req.body.post_date ? new Date(req.body.post_date) : new Date();
  var now      = new Date();

  if (!title) {
    return res.render('admin/post-editor', {
      pageTitle: postType === 'page' ? 'Nova Página' : 'Novo Post',
      currentPage: postType === 'page' ? 'pages' : 'posts',
      postType, post: req.body, isEdit: false,
      formAction: '/admin/' + (postType === 'page' ? 'pages' : 'posts'),
      error: 'O título é obrigatório.'
    });
  }

  try {
    var [result] = await db.query(
      "INSERT INTO wp_posts (post_author,post_date,post_date_gmt,post_content,post_title,post_excerpt,post_status,post_name,post_type,post_parent,post_modified,post_modified_gmt,to_ping,pinged,post_content_filtered,guid) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,'','','','')",
      [req.user.id, date, date, content, title, excerpt, status, slug, postType, now, now]
    );
    var newId = result.insertId;
    await db.query('UPDATE wp_posts SET guid=? WHERE ID=?', ['http://localhost:' + (process.env.PORT || 3000) + '/?p=' + newId, newId]);

    res.flash('success', status === 'publish' ? 'Publicado com sucesso!' : 'Rascunho guardado.');
    res.redirect('/admin/' + (postType === 'page' ? 'pages' : 'posts') + '/' + newId + '/edit');
  } catch (err) {
    console.error(err);
    res.render('admin/post-editor', {
      pageTitle: postType === 'page' ? 'Nova Página' : 'Novo Post',
      currentPage: postType === 'page' ? 'pages' : 'posts',
      postType, post: req.body, isEdit: false,
      formAction: '/admin/' + (postType === 'page' ? 'pages' : 'posts'),
      error: 'Erro ao guardar: ' + err.message
    });
  }
}

// ────────────────────────────────────────────────
// POSTS — editar (GET)
// ────────────────────────────────────────────────
router.get('/posts/:id/edit', async function(req, res) {
  await editGet(req, res, 'post');
});
router.get('/pages/:id/edit', async function(req, res) {
  await editGet(req, res, 'page');
});

async function editGet(req, res, postType) {
  var [rows] = await db.query('SELECT * FROM wp_posts WHERE ID=?', [req.params.id]);
  if (!rows.length) return res.redirect('/admin/' + (postType === 'page' ? 'pages' : 'posts'));
  res.render('admin/post-editor', {
    pageTitle: 'Editar ' + (postType === 'page' ? 'Página' : 'Post'),
    currentPage: postType === 'page' ? 'pages' : 'posts',
    postType, post: rows[0], isEdit: true,
    formAction: '/admin/' + (postType === 'page' ? 'pages' : 'posts') + '/' + req.params.id,
    error: null
  });
}

// ────────────────────────────────────────────────
// POSTS — atualizar (POST)
// ────────────────────────────────────────────────
router.post('/posts/:id', async function(req, res) {
  await updatePost(req, res, 'post');
});
router.post('/pages/:id', async function(req, res) {
  await updatePost(req, res, 'page');
});

async function updatePost(req, res, postType) {
  var id      = req.params.id;
  var title   = (req.body.post_title || '').trim();
  var content = req.body.post_content || '';
  var excerpt = req.body.post_excerpt || '';
  var slug    = (req.body.post_name || makeSlug(title)).trim();
  var action  = req.body.action || 'draft';
  var status  = action === 'publish' ? 'publish' : 'draft';
  var date    = req.body.post_date ? new Date(req.body.post_date) : new Date();
  var now     = new Date();

  if (!title) {
    var [rows] = await db.query('SELECT * FROM wp_posts WHERE ID=?', [id]);
    return res.render('admin/post-editor', {
      pageTitle: 'Editar ' + (postType === 'page' ? 'Página' : 'Post'),
      currentPage: postType === 'page' ? 'pages' : 'posts',
      postType, post: Object.assign(rows[0] || {}, req.body, { ID: id }), isEdit: true,
      formAction: '/admin/' + (postType === 'page' ? 'pages' : 'posts') + '/' + id,
      error: 'O título é obrigatório.'
    });
  }

  try {
    await db.query(
      'UPDATE wp_posts SET post_title=?,post_content=?,post_excerpt=?,post_status=?,post_name=?,post_date=?,post_date_gmt=?,post_modified=?,post_modified_gmt=? WHERE ID=?',
      [title, content, excerpt, status, slug, date, date, now, now, id]
    );
    res.flash('success', status === 'publish' ? 'Publicado com sucesso!' : 'Rascunho guardado.');
    res.redirect('/admin/' + (postType === 'page' ? 'pages' : 'posts') + '/' + id + '/edit');
  } catch (err) {
    console.error(err);
    res.flash('error', 'Erro ao atualizar: ' + err.message);
    res.redirect('/admin/' + (postType === 'page' ? 'pages' : 'posts') + '/' + id + '/edit');
  }
}

// ────────────────────────────────────────────────
// POSTS — apagar
// ────────────────────────────────────────────────
router.post('/posts/:id/delete', async function(req, res) {
  await db.query('DELETE FROM wp_posts WHERE ID=?', [req.params.id]);
  res.flash('success', 'Post apagado.');
  res.redirect('/admin/posts');
});
router.post('/pages/:id/delete', async function(req, res) {
  await db.query('DELETE FROM wp_posts WHERE ID=?', [req.params.id]);
  res.flash('success', 'Página apagada.');
  res.redirect('/admin/pages');
});

// ────────────────────────────────────────────────
// MEDIA
// ────────────────────────────────────────────────
router.get('/media', function(req, res) {
  var uploadDir = path.join(__dirname, '../public/uploads');
  var files = [];
  if (fs.existsSync(uploadDir)) {
    files = fs.readdirSync(uploadDir).map(function(filename) {
      var stat = fs.statSync(path.join(uploadDir, filename));
      return { filename: filename, url: '/uploads/' + filename, size: stat.size, date: stat.mtime };
    }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  }
  res.render('admin/media', { pageTitle: 'Media', currentPage: 'media', files: files });
});

router.post('/media/upload', upload.single('file'), function(req, res) {
  if (!req.file) {
    res.flash('error', 'Nenhum ficheiro recebido.');
    return res.redirect('/admin/media');
  }
  res.flash('success', 'Ficheiro carregado: ' + req.file.originalname);
  res.redirect('/admin/media');
});

router.post('/media/:filename/delete', function(req, res) {
  var filepath = path.join(__dirname, '../public/uploads', req.params.filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    res.flash('success', 'Ficheiro apagado.');
  } else {
    res.flash('error', 'Ficheiro não encontrado.');
  }
  res.redirect('/admin/media');
});

// ────────────────────────────────────────────────
// UTILIZADORES
// ────────────────────────────────────────────────
router.get('/users', async function(req, res) {
  var [users] = await db.query('SELECT id,username,email,role,userProfile,authProvider,createdAt FROM registers ORDER BY createdAt DESC');
  res.render('admin/users', {
    pageTitle: 'Utilizadores', currentPage: 'users',
    users: users, currentUser: req.user
  });
});

router.post('/users', async function(req, res) {
  var bcrypt = require('bcryptjs');
  var username = req.body.username;
  var email    = req.body.email;
  var password = req.body.password;
  var role     = req.body.role || 'user';

  if (!username || !email || !password) {
    res.flash('error', 'Todos os campos são obrigatórios.');
    return res.redirect('/admin/users');
  }

  try {
    var [existing] = await db.query('SELECT id FROM registers WHERE email=?', [email]);
    if (existing.length) {
      res.flash('error', 'Este email já está registado.');
      return res.redirect('/admin/users');
    }
    var hashed = await bcrypt.hash(password, 12);
    var now = new Date();
    await db.query(
      'INSERT INTO registers (username,email,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
      [username, email, hashed, role, now, now]
    );
    res.flash('success', 'Utilizador criado com sucesso.');
  } catch (err) {
    res.flash('error', 'Erro: ' + err.message);
  }
  res.redirect('/admin/users');
});

router.post('/users/:id', async function(req, res) {
  var username = req.body.username;
  var email    = req.body.email;
  var role     = req.body.role;
  var password = req.body.password;
  var now      = new Date();
  var fields   = ['username=?', 'email=?', 'role=?', 'updatedAt=?'];
  var vals     = [username, email, role, now];

  if (password && password.length >= 8) {
    var bcrypt = require('bcryptjs');
    fields.push('password=?');
    vals.push(await bcrypt.hash(password, 12));
  }
  vals.push(req.params.id);

  try {
    await db.query('UPDATE registers SET ' + fields.join(',') + ' WHERE id=?', vals);
    res.flash('success', 'Utilizador atualizado.');
  } catch (err) {
    res.flash('error', 'Erro: ' + err.message);
  }
  res.redirect('/admin/users');
});

router.post('/users/:id/delete', async function(req, res) {
  if (parseInt(req.params.id) === req.user.id) {
    res.flash('error', 'Não podes apagar a tua própria conta.');
    return res.redirect('/admin/users');
  }
  await db.query('DELETE FROM registers WHERE id=?', [req.params.id]);
  res.flash('success', 'Utilizador apagado.');
  res.redirect('/admin/users');
});

module.exports = router;
