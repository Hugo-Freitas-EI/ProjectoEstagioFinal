const db = require('../db');

const Category = {

  async findAll() {
    const [rows] = await db.query(
      'SELECT id, name, slug, description, created_at FROM categories ORDER BY name ASC'
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM categories WHERE id=?', [id]);
    return row || null;
  },

  async findBySlug(slug) {
    const [[row]] = await db.query('SELECT * FROM categories WHERE slug=?', [slug]);
    return row || null;
  },

  async create({ name, slug, description = '' }) {
    const [r] = await db.query(
      'INSERT INTO categories (name, slug, description, created_at) VALUES (?,?,?,NOW())',
      [name, slug, description]
    );
    return r.insertId;
  },

  async update(id, { name, slug, description }) {
    await db.query(
      'UPDATE categories SET name=?, slug=?, description=? WHERE id=?',
      [name, slug, description, id]
    );
  },

  async delete(id) {
    // Apaga os terms associados (e post_terms em cascade se configurado, senão aqui)
    const [terms] = await db.query('SELECT id FROM terms WHERE category_id=?', [id]);
    if (terms.length) {
      const ids = terms.map(t => t.id);
      await db.query(`DELETE FROM post_terms WHERE term_id IN (${ids.map(() => '?').join(',')})`, ids);
      await db.query(`DELETE FROM terms WHERE category_id=?`, [id]);
    }
    await db.query('DELETE FROM categories WHERE id=?', [id]);
  },

  // Conta quantos posts têm termos desta categoria
  async countPosts(id) {
    const [[{ c }]] = await db.query(
      `SELECT COUNT(DISTINCT pt.post_id) c FROM post_terms pt
       JOIN terms t ON t.id = pt.term_id WHERE t.category_id=?`,
      [id]
    );
    return c;
  }
};

module.exports = Category;
