const db = require('../db');

const FieldGroup = {

  async findAll() {
    const [rows] = await db.query(
      'SELECT id, name, post_type FROM field_groups ORDER BY post_type, name'
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM field_groups WHERE id=?', [id]);
    return row || null;
  },

  async findByPostType(postType) {
    const [rows] = await db.query(
      'SELECT * FROM field_groups WHERE post_type=? ORDER BY id',
      [postType]
    );
    return rows;
  },

  async create({ name, postType }) {
    const [r] = await db.query(
      'INSERT INTO field_groups (name, post_type) VALUES (?,?)',
      [name, postType]
    );
    return r.insertId;
  },

  async update(id, { name, postType }) {
    await db.query('UPDATE field_groups SET name=?, post_type=? WHERE id=?', [name, postType, id]);
  },

  async delete(id) {
    // Cascata manual: apagar post_meta → fields → field_group
    const [fields] = await db.query('SELECT id FROM fields WHERE field_group_id=?', [id]);
    if (fields.length) {
      const fids = fields.map(f => f.id);
      await db.query(`DELETE FROM post_meta WHERE field_id IN (${fids.map(() => '?').join(',')})`, fids);
      await db.query('DELETE FROM fields WHERE field_group_id=?', [id]);
    }
    await db.query('DELETE FROM field_groups WHERE id=?', [id]);
  }
};

module.exports = FieldGroup;
