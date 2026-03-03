const db = require('../db');

const Term = {

  async findAll({ categoryId = null } = {}) {
    let sql = `SELECT t.id, t.name, t.slug, t.description,
                      c.id AS category_id, c.name AS category_name
               FROM terms t
               JOIN categories c ON c.id = t.category_id`;
    const params = [];
    if (categoryId) { sql += ' WHERE t.category_id=?'; params.push(categoryId); }
    sql += ' ORDER BY c.name, t.name';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query(
      `SELECT t.*, c.name AS category_name
       FROM terms t JOIN categories c ON c.id=t.category_id WHERE t.id=?`,
      [id]
    );
    return row || null;
  },

  async create({ name, slug, description = '', categoryId }) {
    const [r] = await db.query(
      'INSERT INTO terms (name, slug, description, category_id, created_at) VALUES (?,?,?,?,NOW())',
      [name, slug, description, categoryId]
    );
    return r.insertId;
  },

  async update(id, { name, slug, description, categoryId }) {
    await db.query(
      'UPDATE terms SET name=?, slug=?, description=?, category_id=? WHERE id=?',
      [name, slug, description, categoryId, id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM post_terms WHERE term_id=?', [id]);
    await db.query('DELETE FROM terms WHERE id=?', [id]);
  },

  // Termos de um post
  async findByPost(postId) {
    const [rows] = await db.query(
      `SELECT t.id, t.name, t.slug, c.id AS category_id, c.name AS category_name
       FROM post_terms pt
       JOIN terms t ON t.id = pt.term_id
       JOIN categories c ON c.id = t.category_id
       WHERE pt.post_id=?`,
      [postId]
    );
    return rows;
  },

  // Sincroniza os termos de um post (substitui todos)
  async syncPost(postId, termIds = []) {
    await db.query('DELETE FROM post_terms WHERE post_id=?', [postId]);
    if (termIds.length) {
      const values = termIds.map(tid => [postId, tid]);
      await db.query('INSERT INTO post_terms (post_id, term_id) VALUES ?', [values]);
    }
  }
};

module.exports = Term;
