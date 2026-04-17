const db = require('../db');

const Category = {

  async findAll() {
    const [rows] = await db.query(
      'SELECT id, name, slug, description, created_at FROM categories ORDER BY name ASC'
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    return row || null;
  },

  async findBySlug(slug) {
    const [[row]] = await db.query('SELECT * FROM categories WHERE slug = ?', [slug]);
    return row || null;
  },

  async create({ name, slug, description = '', createdBy = null }) {
    const [r] = await db.query(
      'INSERT INTO categories (name, slug, description, created_at, updated_at, created_by, updated_by) VALUES (?,?,?,NOW(),NOW(),?,?)',
      [name, slug, description || null, createdBy, createdBy]
    );
    return r.insertId;
  },

  async update(id, { name, slug, description, updatedBy = null }) {
    await db.query(
      'UPDATE categories SET name = ?, slug = ?, description = ?, updated_at = NOW(), updated_by = ? WHERE id = ?',
      [name, slug, description || null, updatedBy, id]
    );
  },

  // A FK fk_terms_category tem ON DELETE CASCADE
  // → apagar a categoria apaga automaticamente os terms
  // → terms.post_terms também tem CASCADE → post_terms limpos automaticamente
  async delete(id) {
    await db.query('DELETE FROM categories WHERE id = ?', [id]);
  },

  async countPosts(id) {
    const [[{ c }]] = await db.query(
      `SELECT COUNT(DISTINCT pt.post_id) c
       FROM post_terms pt
       JOIN terms t ON t.id = pt.term_id
       WHERE t.category_id = ?`,
      [id]
    );
    return c;
  }
};

module.exports = Category;
