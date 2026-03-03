const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /admin/api/users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, role, userProfile, authProvider, createdAt FROM registers ORDER BY createdAt DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, role, userProfile, authProvider, createdAt FROM registers WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/api/users
router.post('/', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email e password obrigatórios' });
    }

    const [existing] = await db.query('SELECT id FROM registers WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ error: 'Email já em uso' });

    const hashed = await bcrypt.hash(password, 12);
    const now = new Date();

    const [result] = await db.query(
      'INSERT INTO registers (username, email, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashed, role, now, now]
    );

    res.status(201).json({ id: result.insertId, message: 'Utilizador criado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const { username, email, role, password } = req.body;
    const now = new Date();

    const fields = ['updatedAt = ?'];
    const values = [now];

    if (username) { fields.push('username = ?'); values.push(username); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (password) {
      const hashed = await bcrypt.hash(password, 12);
      fields.push('password = ?');
      values.push(hashed);
    }

    values.push(req.params.id);
    await db.query(`UPDATE registers SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Utilizador atualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Não podes apagar a tua própria conta' });
    }
    await db.query('DELETE FROM registers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Utilizador apagado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register.js
Register.hasMany(Post, {
  foreignKey: 'post_author',
  as: 'posts'
});

module.exports = router;
