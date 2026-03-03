const db = require('../db');

const PostMeta = {

  // Lê todos os valores de meta de um post
  async findByPost(postId) {
    const [rows] = await db.query(
      `SELECT pm.id, pm.field_id, pm.value,
              f.label, f.name AS field_name, f.type,
              fg.name AS group_name
       FROM post_meta pm
       JOIN fields f ON f.id = pm.field_id
       JOIN field_groups fg ON fg.id = f.field_group_id
       WHERE pm.post_id = ?`,
      [postId]
    );
    return rows;
  },

  // Lê o valor de um campo específico
  async getValue(postId, fieldId) {
    const [[row]] = await db.query(
      'SELECT value FROM post_meta WHERE post_id=? AND field_id=?',
      [postId, fieldId]
    );
    return row ? row.value : null;
  },

  // Guarda (upsert) o valor de um campo
  async setValue(postId, fieldId, value) {
    await db.query(
      `INSERT INTO post_meta (post_id, field_id, value)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE value=VALUES(value)`,
      [postId, fieldId, value]
    );
  },

  // Guarda múltiplos campos de uma vez (usado no save do editor)
  async setMany(postId, fieldsMap) {
    // fieldsMap = { fieldId: value, ... }
    const entries = Object.entries(fieldsMap);
    if (!entries.length) return;
    for (const [fieldId, value] of entries) {
      await PostMeta.setValue(postId, fieldId, value ?? '');
    }
  },

  async deleteByPost(postId) {
    await db.query('DELETE FROM post_meta WHERE post_id=?', [postId]);
  }
};

module.exports = PostMeta;
