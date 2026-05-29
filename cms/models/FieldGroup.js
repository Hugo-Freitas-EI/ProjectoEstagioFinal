const db = require('../db');

const FieldGroup = {

  async findAll() {
    const [rows] = await db.query(
      'SELECT id, name, post_type FROM field_groups ORDER BY name'
    );
    rows.forEach(r => { r.post_types = r.post_type ? r.post_type.split(',') : []; });
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM field_groups WHERE id=?', [id]);
    if (row) row.post_types = row.post_type ? row.post_type.split(',') : [];
    return row || null;
  },

  async findByPostType(postType) {
    const [rows] = await db.query(
      'SELECT * FROM field_groups WHERE FIND_IN_SET(?, post_type) ORDER BY id',
      [postType]
    );
    rows.forEach(r => { r.post_types = r.post_type ? r.post_type.split(',') : []; });
    return rows;
  },

  async create({ name, postType, createdBy = null }) {
    const [r] = await db.query(
      'INSERT INTO field_groups (name, post_type, created_at, updated_at, created_by, updated_by) VALUES (?,?,NOW(),NOW(),?,?)',
      [name, postType, createdBy, createdBy]
    );
    return r.insertId;
  },

  async update(id, { name, postType, updatedBy = null }) {
    await db.query(
      'UPDATE field_groups SET name=?, post_type=?, updated_at=NOW(), updated_by=? WHERE id=?',
      [name, postType, updatedBy, id]
    );
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
