const db          = require('../db');
const SiteSetting = require('./SiteSetting');

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
    for (const sys of PostType.SYSTEM) {
      const currentName = await SiteSetting.get(`sys_name_${sys.name}`) || sys.name;
      if (name === sys.name || name === currentName) {
        const label  = await SiteSetting.get(`sys_label_${sys.name}`) || sys.label;
        const prefix = await SiteSetting.get(`sys_prefix_${sys.name}`) || currentName;
        return { ...sys, name: currentName, sysKey: sys.name, label, prefix };
      }
    }
    const [[row]] = await db.query(
      'SELECT * FROM post_types WHERE name=? AND active=1', [name]
    );
    if (row) row.prefix = row.name;
    return row || null;
  },

  async findByPrefix(prefix) {
    for (const sys of PostType.SYSTEM) {
      const pt = await PostType.findByName(sys.name);
      if (pt.prefix === prefix || pt.name === prefix) return pt;
    }
    const [[row]] = await db.query(
      'SELECT * FROM post_types WHERE name=? AND active=1', [prefix]
    );
    if (row) { row.prefix = row.name; return row; }
    return null;
  },

  async findAllWithSystem() {
    const custom = await PostType.findAll();
    const system = await Promise.all(PostType.SYSTEM.map(s => PostType.findByName(s.name)));
    return [...system, ...custom];
  },

  async updateSystem(sysKey, { label, prefix, newName }) {
    if (label?.trim()) await SiteSetting.set(`sys_label_${sysKey}`, label.trim());
    if (prefix?.trim()) {
      const clean = prefix.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      await SiteSetting.set(`sys_prefix_${sysKey}`, clean || sysKey);
    }
    if (newName?.trim()) {
      const cleanName = newName.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      const currentName = await SiteSetting.get(`sys_name_${sysKey}`) || sysKey;
      if (cleanName && cleanName !== currentName) {
        await db.query('UPDATE wp_posts SET post_type=? WHERE post_type=?', [cleanName, currentName]);
        await SiteSetting.set(`sys_name_${sysKey}`, cleanName);
        const storedPrefix = await SiteSetting.get(`sys_prefix_${sysKey}`);
        if (!storedPrefix || storedPrefix === currentName) {
          await SiteSetting.set(`sys_prefix_${sysKey}`, cleanName);
        }
        // Migrate field_groups comma-separated post_type values
        const [fgRows] = await db.query(
          "SELECT id, post_type FROM field_groups WHERE FIND_IN_SET(?, post_type)", [currentName]
        );
        for (const row of fgRows) {
          const updated = row.post_type.split(',')
            .map(t => t.trim() === currentName ? cleanName : t).join(',');
          await db.query('UPDATE field_groups SET post_type=? WHERE id=?', [updated, row.id]);
        }
      }
    }
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
