require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const cookieParser = require('cookie-parser');
const path         = require('path');
const flash        = require('./middleware/flash');
const sidebarData  = require('./middleware/sidebarData');
const SiteSetting  = require('./models/SiteSetting');
const Role         = require('./models/Role');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'nodecms_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(flash);

// Variáveis globais para todas as views (settings carregados da BD)
app.use(async function(req, res, next) {
  try {
    const s = await SiteSetting.getAll();
    res.locals.user        = req.session.user || null;
    res.locals.siteName    = s.site_title       || process.env.SITE_NAME    || 'NodeCMS';
    res.locals.siteTagline = s.site_description || process.env.SITE_TAGLINE || '';
    res.locals.siteIcon    = s.site_icon        || null;
    res.locals.siteNoIndex = s.search_engine_visibility === '1';
  } catch {
    res.locals.user        = req.session.user || null;
    res.locals.siteName    = process.env.SITE_NAME    || 'NodeCMS';
    res.locals.siteTagline = process.env.SITE_TAGLINE || '';
    res.locals.siteIcon    = null;
    res.locals.siteNoIndex = false;
  }
  next();
});

// Injeta customPostTypes na sidebar (só rotas /admin/*)
app.use('/admin', sidebarData);

// Ficheiros estáticos
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/css',     express.static(path.join(__dirname, 'public/css')));
app.use('/js',      express.static(path.join(__dirname, 'public/js')));

// ── robots.txt dinâmico ───────────────────────────────────────────────────────
app.get('/robots.txt', async function(req, res) {
  try {
    const discourage = await SiteSetting.get('search_engine_visibility');
    res.type('text/plain');
    if (discourage === '1') {
      res.send('User-agent: *\nDisallow: /');
    } else {
      res.send('User-agent: *\nDisallow:');
    }
  } catch {
    res.type('text/plain').send('User-agent: *\nDisallow:');
  }
});

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use('/admin',                    require('./routes/auth'));
app.use('/admin',                    require('./routes/password-reset'));
app.use('/admin/post-types',         require('./routes/postTypes'));
app.use('/admin/cpt/:postType',      require('./routes/cpt'));         // rota dinâmica CPT
app.use(require('./routes/admin-revisions'));
app.use('/admin/media',              require('./routes/media'));        // media (BD)
app.use('/admin',                    require('./routes/admin'));         // users, categories, etc
app.use('/',                         require('./routes/frontend'));

// 404
app.use(function(req, res) {
  res.status(404).render('frontend/404', { pageTitle: 'Página não encontrada', navPages: [] });
});

// Erro global
app.use(function(err, req, res, next) {
  console.error('Erro:', err.stack);
  res.status(500).render('frontend/error', {
    pageTitle: 'Erro', message: err.message, navPages: []
  });
});

const PORT = process.env.PORT || 3000;
Role.migrate()
  .then(() => app.listen(PORT, function() {
    console.log('NodeCMS a correr em http://localhost:' + PORT);
    console.log('Admin:  http://localhost:' + PORT + '/admin');
  }))
  .catch(err => { console.error('Erro na migração de roles:', err); process.exit(1); });
