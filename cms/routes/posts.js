const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const slugify = require('slugify');

// Todos os endpoints protegidos
router.use(requireAuth);

// ── LISTAR POSTS ──
// GET /admin/api/posts?type=post&status=all&search=...&page=1
router.get('/', async (req, res) => {
  try {
    const { type = 'post', status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['post_type = ?'];
    let params = [type];

    if (status && status !== 'all') {
      where.push('post_status = ?');
      params.push(status);
    } else {
      // Nunca mostrar revisões automáticas
      where.push("post_status != 'auto-draft'");
    }

    if (search) {
      where.push('(post_title LIKE ? OR post_content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereStr = where.join(' AND ');

    const [rows] = await db.query(
      `SELECT ID, post_title, post_name, post_status, post_date, post_type, post_author, comment_count
       FROM wp_posts WHERE ${whereStr}
       ORDER BY post_date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM wp_posts WHERE ${whereStr}`,
      params
    );

    res.json({ posts: rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── VER UM POST ──
// GET /admin/api/posts/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM wp_posts WHERE ID = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CRIAR POST ──
// POST /admin/api/posts
router.post('/', async (req, res) => {
  try {
    const {
      post_title, post_content, post_excerpt = '',
      post_status = 'draft', post_type = 'post',
      post_name, post_parent = 0
    } = req.body;

    if (!post_title) return res.status(400).json({ error: 'Título obrigatório' });

    const slug = post_name || slugify(post_title, { lower: true, strict: true });
    const now = new Date();
    const authorId = req.user.id;

    const [result] = await db.query(
      `INSERT INTO wp_posts 
       (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
        post_status, post_name, post_type, post_parent, post_modified, post_modified_gmt,
        to_ping, pinged, post_content_filtered, guid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', ?)`,
      [authorId, now, now, post_content, post_title, post_excerpt,
       post_status, slug, post_type, post_parent, now, now,
       `http://localhost:${process.env.PORT}/?p=0`]
    );

    // Atualiza o guid com o ID real
    const newId = result.insertId;
    await db.query('UPDATE wp_posts SET guid = ? WHERE ID = ?', [
      `http://localhost:${process.env.PORT}/?p=${newId}`, newId
    ]);

    res.status(201).json({ id: newId, message: 'Post criado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── ATUALIZAR POST ──
// PUT /admin/api/posts/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      post_title, post_content, post_excerpt,
      post_status, post_name
    } = req.body;

    const now = new Date();
    const slug = post_name || (post_title ? slugify(post_title, { lower: true, strict: true }) : undefined);

    // Constrói update dinâmico
    const fields = [];
    const values = [];

    if (post_title !== undefined) { fields.push('post_title = ?'); values.push(post_title); }
    if (post_content !== undefined) { fields.push('post_content = ?'); values.push(post_content); }
    if (post_excerpt !== undefined) { fields.push('post_excerpt = ?'); values.push(post_excerpt); }
    if (post_status !== undefined) { fields.push('post_status = ?'); values.push(post_status); }
    if (slug) { fields.push('post_name = ?'); values.push(slug); }

    fields.push('post_modified = ?', 'post_modified_gmt = ?');
    values.push(now, now);
    values.push(req.params.id);

    if (fields.length === 2) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    await db.query(`UPDATE wp_posts SET ${fields.join(', ')} WHERE ID = ?`, values);

    res.json({ message: 'Post atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── APAGAR POST ──
// DELETE /admin/api/posts/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM wp_posts WHERE ID = ?', [req.params.id]);
    res.json({ message: 'Post apagado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ESTATÍSTICAS ──
// GET /admin/api/posts/stats/overview
router.get('/stats/overview', async (req, res) => {
  try {
    const [[posts]] = await db.query("SELECT COUNT(*) as total FROM wp_posts WHERE post_type='post' AND post_status='publish'");
    const [[drafts]] = await db.query("SELECT COUNT(*) as total FROM wp_posts WHERE post_type='post' AND post_status='draft'");
    const [[pages]] = await db.query("SELECT COUNT(*) as total FROM wp_posts WHERE post_type='page' AND post_status='publish'");
    const [[users]] = await db.query("SELECT COUNT(*) as total FROM registers");

    res.json({
      publishedPosts: posts.total,
      draftPosts: drafts.total,
      publishedPages: pages.total,
      totalUsers: users.total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
