const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// GET /admin/login
router.get('/login', async (req, res) => {
  const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM registers');
  if (total === 0) return res.redirect('/admin/register');
  res.render('admin/login', { error: null });
});

// POST /admin/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.render('admin/login', { error: 'Email e password obrigatórios' });
  try {
    const [rows] = await db.query('SELECT * FROM registers WHERE email = ? LIMIT 1', [email]);
    if (!rows.length) return res.render('admin/login', { error: 'Email ou password incorretos' });
    const u = rows[0];
    if (!u.password) return res.render('admin/login', { error: 'Esta conta usa login social (OAuth)' });
    const valid = await bcrypt.compare(password, u.password);
    if (!valid) return res.render('admin/login', { error: 'Email ou password incorretos' });

    const token = jwt.sign(
      { id: u.id, email: u.email, username: u.username, role: u.role || 'user' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    req.session.token = token;
    req.session.user = { id: u.id, username: u.username, email: u.email, role: u.role };
    res.cookie('token', token, { httpOnly: true, maxAge: 7*24*60*60*1000 });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.render('admin/login', { error: 'Erro interno. Tenta novamente.' });
  }
});

// GET /admin/logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie('token');
  res.redirect('/admin/login');
});

// GET /admin/register
router.get('/register', (req, res) => {
  res.render('admin/register', { error: null });
});

// POST /admin/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.render('admin/register', { error: 'Todos os campos são obrigatórios' });
  try {
    const [existing] = await db.query('SELECT id FROM registers WHERE email = ?', [email]);
    if (existing.length) return res.render('admin/register', { error: 'Este email já está registado' });
    const hashed = await bcrypt.hash(password, 12);
    const now = new Date();
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM registers');
    const role = total === 0 ? 'admin' : 'subscriber';
    await db.query(
      'INSERT INTO registers (username, email, password, role, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
      [username, email, hashed, role, now, now]
    );
    res.redirect('/admin/login');
  } catch (err) {
    console.error(err);
    res.render('admin/register', { error: 'Erro ao criar conta' });
  }
});

module.exports = router;
