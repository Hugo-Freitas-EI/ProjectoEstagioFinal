require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const cookieParser = require('cookie-parser');
const path         = require('path');
const flash        = require('./middleware/flash');
const sidebarData  = require('./middleware/sidebarData');

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

// Variáveis globais para todas as views
app.use(function(req, res, next) {
  res.locals.user        = req.session.user || null;
  res.locals.siteName    = process.env.SITE_NAME    || 'NodeCMS';
  res.locals.siteTagline = process.env.SITE_TAGLINE || '';
  next();
});

// Injeta customPostTypes na sidebar (só rotas /admin/*)
app.use('/admin', sidebarData);

// Ficheiros estáticos
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/css',     express.static(path.join(__dirname, 'public/css')));
app.use('/js',      express.static(path.join(__dirname, 'public/js')));

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use('/admin',                    require('./routes/auth'));
app.use('/admin/post-types',         require('./routes/postTypes'));
app.use('/admin/cpt/:postType',      require('./routes/cpt'));         // rota dinâmica CPT
app.use('/admin/posts/:id/revisions',require('./routes/admin-revisions'));
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
app.listen(PORT, function() {
  console.log('NodeCMS a correr em http://localhost:' + PORT);
  console.log('Admin:  http://localhost:' + PORT + '/admin');
});
