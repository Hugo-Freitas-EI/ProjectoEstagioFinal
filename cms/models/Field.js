const db = require('../db');

// Tipos de campo suportados
const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'url', 'email', 'select', 'checkbox', 'image'];

const Field = {

  TYPES: FIELD_TYPES,

  async findByGroup(groupId) {
    const [rows] = await db.query(
      'SELECT * FROM fields WHERE field_group_id=? ORDER BY id',
      [groupId]
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM fields WHERE id=?', [id]);
    return row || null;
  },

  async create({ groupId, label, name, type, options = null, required = 0 }) {
    const [r] = await db.query(
      'INSERT INTO fields (field_group_id, label, name, type, options, required) VALUES (?,?,?,?,?,?)',
      [groupId, label, name, type, options, required]
    );
    return r.insertId;
  },

  async update(id, { label, name, type, options = null, required = 0 }) {
    await db.query(
      'UPDATE fields SET label=?, name=?, type=?, options=?, required=? WHERE id=?',
      [label, name, type, options, required, id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM post_meta WHERE field_id=?', [id]);
    await db.query('DELETE FROM fields WHERE id=?', [id]);
  }
};

module.exports = Field;
