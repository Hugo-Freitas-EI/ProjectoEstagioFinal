const express             = require('express');
const router              = express.Router();
const { requireAuth }     = require('../middleware/auth');
const PostController      = require('../controllers/postController');
const CategoryController  = require('../controllers/categoryController');
const TermController      = require('../controllers/termController');
const FieldGroupController= require('../controllers/fieldGroupController');
const db                  = require('../db');
const path                = require('path');
const fs                  = require('fs');
const multer              = require('multer');

// ══════════════════════════════════════════════════════════════════════════════
// MULTER - CONFIGURAÇÃO DE UPLOAD DE MEDIA
// ══════════════════════════════════════════════════════════════════════════════
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e5);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}${ext}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|pdf|mp4|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Tipo de ficheiro não permitido'));
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE - PROTEÇÃO DE ROTAS
// ══════════════════════════════════════════════════════════════════════════════
router.use((req, res, next) => {
  const publicRoutes = ['/login', '/register', '/logout'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  requireAuth(req, res, next);
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE - INJETAR POST_TYPE
// ══════════════════════════════════════════════════════════════════════════════
router.use('/posts', (req, res, next) => { 
  req.basePostType = 'post'; 
  next(); 
});

router.use('/pages', (req, res, next) => { 
  req.basePostType = 'page'; 
  next(); 
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const [[publishedPosts]] = await db.query(
      "SELECT COUNT(*) c FROM wp_posts WHERE post_type='post' AND post_status='publish'"
    );
    const [[draftPosts]] = await db.query(
      "SELECT COUNT(*) c FROM wp_posts WHERE post_type='post' AND post_status='draft'"
    );
    const [[publishedPages]] = await db.query(
      "SELECT COUNT(*) c FROM wp_posts WHERE post_type='page' AND post_status='publish'"
    );
    const [[totalUsers]] = await db.query(
      "SELECT COUNT(*) c FROM registers"
    );
    const [recentPosts] = await db.query(
      `SELECT ID, post_title, post_name, post_status, post_date 
       FROM wp_posts 
       WHERE post_type='post' AND post_status!='auto-draft' 
       ORDER BY post_date DESC 
       LIMIT 6`
    );

    res.render('admin/dashboard', {
      pageTitle: 'Dashboard',
      currentPage: 'dashboard',
      siteName: process.env.SITE_NAME || 'NodeCMS',
      stats: {
        publishedPosts: publishedPosts.c,
        draftPosts: draftPosts.c,
        publishedPages: publishedPages.c,
        totalUsers: totalUsers.c
      },
      recentPosts
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.render('admin/dashboard', {
      pageTitle: 'Dashboard',
      currentPage: 'dashboard',
      siteName: process.env.SITE_NAME || 'NodeCMS',
      stats: {
        publishedPosts: 0,
        draftPosts: 0,
        publishedPages: 0,
        totalUsers: 0
      },
      recentPosts: []
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POSTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/posts',              PostController.list);
router.get('/posts/new',          PostController.newForm);
router.post('/posts',             PostController.create);
router.get('/posts/:id/edit',     PostController.editForm);
router.post('/posts/:id',         PostController.update);
router.post('/posts/:id/delete',  PostController.destroy);

// ══════════════════════════════════════════════════════════════════════════════
// PAGES
// ══════════════════════════════════════════════════════════════════════════════
router.get('/pages',              PostController.list);
router.get('/pages/new',          PostController.newForm);
router.post('/pages',             PostController.create);
router.get('/pages/:id/edit',     PostController.editForm);
router.post('/pages/:id',         PostController.update);
router.post('/pages/:id/delete',  PostController.destroy);

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════════════════════════════
router.get('/categories',             CategoryController.list);
router.get('/categories/new',         CategoryController.newForm);
router.post('/categories',            CategoryController.create);
router.get('/categories/:id/edit',    CategoryController.editForm);
router.post('/categories/:id',        CategoryController.update);
router.post('/categories/:id/delete', CategoryController.destroy);

// ══════════════════════════════════════════════════════════════════════════════
// TERMS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/terms',              TermController.list);
router.get('/terms/new',          TermController.newForm);
router.post('/terms',             TermController.create);
router.get('/terms/:id/edit',     TermController.editForm);
router.post('/terms/:id',         TermController.update);
router.post('/terms/:id/delete',  TermController.destroy);

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOM FIELDS (FIELD GROUPS)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/field-groups',                                     FieldGroupController.list);
router.get('/field-groups/new',                                 FieldGroupController.newForm);
router.post('/field-groups',                                    FieldGroupController.create);
router.get('/field-groups/:id/edit',                            FieldGroupController.editForm);
router.post('/field-groups/:id',                                FieldGroupController.update);
router.post('/field-groups/:id/delete',                         FieldGroupController.destroy);
router.post('/field-groups/:id/fields',                         FieldGroupController.addField);
router.post('/field-groups/:id/fields/:fieldId',                FieldGroupController.updateField);
router.post('/field-groups/:id/fields/:fieldId/delete',         FieldGroupController.deleteField);

// ══════════════════════════════════════════════════════════════════════════════
// MEDIA
// ══════════════════════════════════════════════════════════════════════════════
router.get('/media', (req, res) => {
  const uploadDir = path.join(__dirname, '../public/uploads');
  let files = [];
  
  if (fs.existsSync(uploadDir)) {
    files = fs.readdirSync(uploadDir)
      .filter(filename => !filename.startsWith('.')) // Ignorar ficheiros ocultos
      .map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stat = fs.statSync(filePath);
        return {
          filename,
          url: '/uploads/' + filename,
          size: stat.size,
          sizeKb: Math.round(stat.size / 1024),
          date: stat.mtime
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  
  res.render('admin/media', {
    pageTitle: 'Media',
    currentPage: 'media',
    files
  });
});

router.post('/media/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    req.flash('error', 'Nenhum ficheiro recebido.');
    return res.redirect('/admin/media');
  }
  
  req.flash('success', `Ficheiro carregado: ${req.file.originalname}`);
  res.redirect('/admin/media');
});

router.post('/media/:filename/delete', (req, res) => {
  const filePath = path.join(__dirname, '../public/uploads', req.params.filename);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      req.flash('success', 'Ficheiro apagado com sucesso.');
    } else {
      req.flash('error', 'Ficheiro não encontrado.');
    }
  } catch (err) {
    console.error('Erro ao apagar ficheiro:', err);
    req.flash('error', 'Erro ao apagar ficheiro.');
  }
  
  res.redirect('/admin/media');
});

// ══════════════════════════════════════════════════════════════════════════════
// USERS (UTILIZADORES)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, role, authProvider, createdAt FROM registers ORDER BY createdAt DESC'
    );
    
    res.render('admin/users', {
      pageTitle: 'Utilizadores',
      currentPage: 'users',
      users,
      currentUser: req.user
    });
  } catch (err) {
    console.error('Erro ao listar utilizadores:', err);
    req.flash('error', 'Erro ao carregar utilizadores.');
    res.redirect('/admin');
  }
});

router.post('/users', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { username, email, password, role } = req.body;

  // Validação
  if (!username || !email || !password) {
    req.flash('error', 'Todos os campos são obrigatórios.');
    return res.redirect('/admin/users');
  }

  if (password.length < 8) {
    req.flash('error', 'A password deve ter pelo menos 8 caracteres.');
    return res.redirect('/admin/users');
  }

  try {
    // Verificar duplicados
    const [existing] = await db.query('SELECT id FROM registers WHERE email=?', [email]);
    if (existing.length) {
      req.flash('error', 'Este email já está registado.');
      return res.redirect('/admin/users');
    }

    // Criar utilizador
    const hashed = await bcrypt.hash(password, 12);
    const now = new Date();
    
    await db.query(
      'INSERT INTO registers (username, email, password, role, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
      [username, email, hashed, role || 'user', now, now]
    );
    
    req.flash('success', `Utilizador "${username}" criado com sucesso.`);
  } catch (err) {
    console.error('Erro ao criar utilizador:', err);
    req.flash('error', 'Erro ao criar utilizador: ' + err.message);
  }
  
  res.redirect('/admin/users');
});

router.post('/users/:id', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { username, email, role, password } = req.body;
  const userId = req.params.id;

  // Validação
  if (!username || !email) {
    req.flash('error', 'Username e email são obrigatórios.');
    return res.redirect('/admin/users');
  }

  try {
    const now = new Date();
    const fields = ['username=?', 'email=?', 'role=?', 'updatedAt=?'];
    const values = [username, email, role || 'user', now];

    // Atualizar password se fornecida
    if (password && password.length >= 8) {
      fields.push('password=?');
      values.push(await bcrypt.hash(password, 12));
    } else if (password && password.length < 8) {
      req.flash('error', 'A password deve ter pelo menos 8 caracteres.');
      return res.redirect('/admin/users');
    }

    values.push(userId);

    await db.query(
      `UPDATE registers SET ${fields.join(',')} WHERE id=?`,
      values
    );
    
    req.flash('success', 'Utilizador atualizado com sucesso.');
  } catch (err) {
    console.error('Erro ao atualizar utilizador:', err);
    req.flash('error', 'Erro ao atualizar utilizador: ' + err.message);
  }
  
  res.redirect('/admin/users');
});

router.post('/users/:id/delete', async (req, res) => {
  const userId = parseInt(req.params.id);

  // Prevenir auto-eliminação
  if (userId === req.user.id) {
    req.flash('error', 'Não podes apagar a tua própria conta.');
    return res.redirect('/admin/users');
  }

  try {
    // Verificar se utilizador existe
    const [[user]] = await db.query('SELECT username FROM registers WHERE id=?', [userId]);
    
    if (!user) {
      req.flash('error', 'Utilizador não encontrado.');
      return res.redirect('/admin/users');
    }

    await db.query('DELETE FROM registers WHERE id=?', [userId]);
    req.flash('success', `Utilizador "${user.username}" apagado com sucesso.`);
  } catch (err) {
    console.error('Erro ao apagar utilizador:', err);
    req.flash('error', 'Erro ao apagar utilizador: ' + err.message);
  }
  
  res.redirect('/admin/users');
});

module.exports = router;
