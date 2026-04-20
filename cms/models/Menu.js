const db = require('../db');

const Menu = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM menus ORDER BY nome ASC');
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM menus WHERE id = ?', [id]);
    return row || null;
  },

  async findBySlug(slug) {
    const [[row]] = await db.query('SELECT * FROM menus WHERE slug = ?', [slug]);
    return row || null;
  },

  async create({ nome, slug }) {
    const [r] = await db.query('INSERT INTO menus (nome, slug) VALUES (?, ?)', [nome, slug]);
    return r.insertId;
  },

  async update(id, { nome, slug }) {
    await db.query('UPDATE menus SET nome = ?, slug = ? WHERE id = ?', [nome, slug, id]);
  },

  async delete(id) {
    await db.query('DELETE FROM menus WHERE id = ?', [id]);
  }
};

module.exports = Menu;
