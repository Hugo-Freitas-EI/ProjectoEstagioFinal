const db = require('../db');

const MenuItem = {
  async findByMenu(menuId) {
    const [rows] = await db.query(
      'SELECT * FROM menuitens WHERE menu_id = ? ORDER BY ordem ASC, id ASC',
      [menuId]
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM menuitens WHERE id = ?', [id]);
    return row || null;
  },

  async create({ nome, link, parent_id, menu_id, ordem = 0 }) {
    const [r] = await db.query(
      'INSERT INTO menuitens (nome, link, parent_id, menu_id, ordem) VALUES (?, ?, ?, ?, ?)',
      [nome, link, parent_id || null, menu_id, ordem]
    );
    return r.insertId;
  },

  async update(id, { nome, link, parent_id, ordem }) {
    await db.query(
      'UPDATE menuitens SET nome = ?, link = ?, parent_id = ?, ordem = ? WHERE id = ?',
      [nome, link, parent_id || null, ordem, id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM menuitens WHERE id = ?', [id]);
  },

  async reorderWithParents(items) {
    for (const item of items) {
      await db.query(
        'UPDATE menuitens SET ordem = ?, parent_id = ? WHERE id = ?',
        [item.ordem, item.parent_id ?? null, item.id]
      );
    }
  }
};

module.exports = MenuItem;
