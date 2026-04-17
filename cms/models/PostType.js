const db = require('../db');

const PostType = {

  SYSTEM: [
    { name: 'post',  label: 'Posts',   system: true },
    { name: 'page',  label: 'Páginas', system: true }
  ],

  async findAll() {
    const [rows] = await db.query(
      'SELECT * FROM post_types WHERE active=1 ORDER BY label ASC'
    );
    return rows;
  },

  async findByName(name) {
    const sys = PostType.SYSTEM.find(s => s.name === name);
    if (sys) return { ...sys };
    const [[row]] = await db.query(
      'SELECT * FROM post_types WHERE name=? AND active=1', [name]
    );
    return row || null;
  },

  async findAllWithSystem() {
    const custom = await PostType.findAll();
    return [...PostType.SYSTEM, ...custom];
  },

  async create({ name, label, description = '', createdBy = null }) {
    const [r] = await db.query(
      'INSERT INTO post_types (name, label, description, created_at, updated_at, created_by, updated_by) VALUES (?,?,?,NOW(),NOW(),?,?)',
      [name, label, description || null, createdBy, createdBy]
    );
    return r.insertId;
  },

  async update(id, { label, description, updatedBy = null }) {
    await db.query(
      'UPDATE post_types SET label=?, description=?, updated_at=NOW(), updated_by=? WHERE id=?',
      [label, description || null, updatedBy, id]
    );
  },

  async delete(id) {
    // soft delete para não partir posts existentes
    await db.query('UPDATE post_types SET active=0 WHERE id=?', [id]);
  },

  async getTaxonomies(postTypeName) {
    const [rows] = await db.query(
      `SELECT c.* FROM categories c
       JOIN category_post_types cpt ON cpt.category_id = c.id
       WHERE cpt.post_type_name = ?
       ORDER BY c.name`,
      [postTypeName]
    );
    return rows;
  },

  async syncTaxonomies(postTypeName, categoryIds = []) {
    await db.query(
      'DELETE FROM category_post_types WHERE post_type_name=?',
      [postTypeName]
    );
    if (categoryIds.length) {
      const vals = categoryIds.map(cid => [Number(cid), postTypeName]);
      await db.query(
        'INSERT INTO category_post_types (category_id, post_type_name) VALUES ?',
        [vals]
      );
    }
  },

  async countPosts(postTypeName) {
    const [[{ c }]] = await db.query(
      "SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status NOT IN ('auto-draft','revision')",
      [postTypeName]
    );
    return c;
  }
};

module.exports = PostType;
