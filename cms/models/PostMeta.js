const db = require('../db');

const PostMeta = {

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

  async getValue(postId, fieldId) {
    const [[row]] = await db.query(
      'SELECT value FROM post_meta WHERE post_id = ? AND field_id = ? LIMIT 1',
      [postId, fieldId]
    );
    return row ? row.value : null;
  },

  // Upsert manual: a tabela não tem UNIQUE KEY (post_id, field_id)
  // por isso ON DUPLICATE KEY UPDATE não funciona — fazemos SELECT + UPDATE ou INSERT
  async setValue(postId, fieldId, value) {
    const [[existing]] = await db.query(
      'SELECT id FROM post_meta WHERE post_id = ? AND field_id = ? LIMIT 1',
      [postId, fieldId]
    );
    if (existing) {
      await db.query('UPDATE post_meta SET value = ? WHERE id = ?', [value, existing.id]);
    } else {
      await db.query(
        'INSERT INTO post_meta (post_id, field_id, value) VALUES (?,?,?)',
        [postId, fieldId, value]
      );
    }
  },

  async setMany(postId, fieldsMap) {
    const entries = Object.entries(fieldsMap);
    if (!entries.length) return;
    for (const [fieldId, value] of entries) {
      await PostMeta.setValue(postId, Number(fieldId), value ?? '');
    }
  },

  async deleteByPost(postId) {
    await db.query('DELETE FROM post_meta WHERE post_id = ?', [postId]);
  }
};

module.exports = PostMeta;
