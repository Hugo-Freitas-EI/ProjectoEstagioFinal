const db = require('../db');

const SiteSetting = {

  /** Returns all settings as a plain object { key: value } */
  async getAll() {
    const [rows] = await db.query('SELECT `key`, `value` FROM site_settings');
    return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
  },

  async get(key) {
    const [[row]] = await db.query('SELECT `value` FROM site_settings WHERE `key` = ?', [key]);
    return row ? row.value : null;
  },

  async set(key, value) {
    await db.query(
      'INSERT INTO site_settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value` = ?',
      [key, value, value]
    );
  },

  /** Bulk-update from a { key: value } map */
  async setMany(map) {
    for (const [key, value] of Object.entries(map)) {
      await SiteSetting.set(key, value ?? null);
    }
  }
};

module.exports = SiteSetting;
