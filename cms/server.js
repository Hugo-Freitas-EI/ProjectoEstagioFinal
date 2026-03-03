require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flashMiddleware = require('./middleware/flash'); // SEM './cms/' porque já está dentro de cms
const mediaRoutes = require('./routes/media');

const app = express();

// Template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'seu-secret-key-aqui',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // true apenas se usar HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Configurar sessão ANTES do flash
app.use(session({
  secret: 'seu-secret-key-aqui',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Configurar flash middleware
app.use(flashMiddleware);

// Variáveis globais para todas as views
app.use(function(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.siteName = process.env.SITE_NAME || 'NodeCMS';
  res.locals.siteTagline = process.env.SITE_TAGLINE || '';
  next();
});

// Ficheiros estáticos
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Rotas
app.use('/admin', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/frontend'));
app.use('/admin/media', mediaRoutes);

// 404
app.use(function(req, res) {
  res.status(404).render('frontend/404', { pageTitle: 'Pagina nao encontrada', navPages: [] });
});

// Erro global
app.use(function(err, req, res, next) {
  console.error('Erro:', err.stack);
  res.status(500).render('frontend/error', { pageTitle: 'Erro', message: err.message, navPages: [] });
});

var PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  //console.log('NodeCMS a correr em http://localhost:' + PORT);
  console.log('Admin: http://localhost:' + PORT + '/admin');
});
