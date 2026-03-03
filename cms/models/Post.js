const db = require('../db');

const Post = {

  // ─── FIND ─────────────────────────────────────────────────────────────────

  async findAll({ postType = 'post', status = null, search = '', page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const params = [postType];
    let where = "p.post_type = ? AND p.post_status != 'auto-draft'";
    if (status) { where += ' AND p.post_status = ?'; params.push(status); }
    if (search) { where += ' AND p.post_title LIKE ?'; params.push(`%${search}%`); }

    const [rows] = await db.query(
      `SELECT p.ID, p.post_title, p.post_name, p.post_status, p.post_date, p.post_author, r.username
      FROM wp_posts p
      LEFT JOIN registers r ON p.post_author = r.id
      WHERE ${where}
       ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) total FROM wp_posts p WHERE ${where}`, params
    );
    return { rows, total };
  },

  async findById(id) {
    const [[row]] = await db.query('SELECT * FROM wp_posts WHERE ID = ?', [id]);
    return row || null;
  },

  async findBySlug(slug, postType = 'post') {
    const [[row]] = await db.query(
      "SELECT * FROM wp_posts WHERE post_name = ? AND post_type = ? AND post_status = 'publish'",
      [slug, postType]
    );
    return row || null;
  },

  async countByStatus(postType) {
    const [[all]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status!='auto-draft'", [postType]);
    const [[publish]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status='publish'", [postType]);
    const [[draft]] = await db.query("SELECT COUNT(*) c FROM wp_posts WHERE post_type=? AND post_status='draft'", [postType]);
    return { all: all.c, publish: publish.c, draft: draft.c };
  },

  // ─── WRITE ────────────────────────────────────────────────────────────────

  async create({ authorId, title, content, excerpt, slug, status, postType, date }) {
    const now = new Date();
    const postDate = date ? new Date(date) : now;
    const [result] = await db.query(
      `INSERT INTO wp_posts
         (post_author, post_date, post_date_gmt, post_content, post_title,
          post_excerpt, post_status, post_name, post_type, post_parent,
          post_modified, post_modified_gmt, to_ping, pinged, post_content_filtered, guid)
       VALUES (?,?,?,?,?,?,?,?,?,0,?,?,'','','','')`,
      [authorId, postDate, postDate, content, title, excerpt, status, slug, postType, now, now]
    );
    const id = result.insertId;
    await db.query('UPDATE wp_posts SET guid=? WHERE ID=?', [`/?p=${id}`, id]);
    return id;
  },

  async update(id, { title, content, excerpt, slug, status, date }) {
    const now = new Date();
    const postDate = date ? new Date(date) : now;
    await db.query(
      `UPDATE wp_posts SET
         post_title=?, post_content=?, post_excerpt=?, post_status=?,
         post_name=?, post_date=?, post_date_gmt=?, post_modified=?, post_modified_gmt=?
       WHERE ID=?`,
      [title, content, excerpt, status, slug, postDate, postDate, now, now, id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM wp_posts WHERE ID=?', [id]);
  },

  // ─── QUERY COMPLETA ───────────────────────────────────────────────────────
  // Carrega post + termos + campos personalizados + valores (post_meta)

  async findWithFullData(id) {
    const [[post]] = await db.query('SELECT * FROM wp_posts WHERE ID=?', [id]);
    if (!post) return null;

    // Termos associados
    const [terms] = await db.query(
      `SELECT t.id, t.name, t.slug, c.id AS category_id, c.name AS category_name
       FROM post_terms pt
       JOIN terms t ON t.id = pt.term_id
       JOIN categories c ON c.id = t.category_id
       WHERE pt.post_id = ?`,
      [id]
    );

    // Campos personalizados com valores
    const [metaFields] = await db.query(
      `SELECT f.id AS field_id, f.label, f.name AS field_name, f.type,
              fg.id AS group_id, fg.name AS group_name,
              pm.value
       FROM field_groups fg
       JOIN fields f ON f.field_group_id = fg.id
       LEFT JOIN post_meta pm ON pm.field_id = f.id AND pm.post_id = ?
       WHERE fg.post_type = ?
       ORDER BY fg.id, f.id`,
      [id, post.post_type]
    );

    // Agrupar campos por grupo
    const groups = {};
    for (const row of metaFields) {
      if (!groups[row.group_id]) {
        groups[row.group_id] = { id: row.group_id, name: row.group_name, fields: [] };
      }
      groups[row.group_id].fields.push({
        id: row.field_id,
        label: row.label,
        name: row.field_name,
        type: row.type,
        value: row.value ?? ''
      });
    }

    return {
      ...post,
      terms,
      fieldGroups: Object.values(groups)
    };
  }
};

module.exports = Post;
