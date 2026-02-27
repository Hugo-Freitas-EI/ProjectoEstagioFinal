const express = require('express');
const router = express.Router();
const db = require('../db');
const { marked } = require('marked');

marked.setOptions({ breaks: true, gfm: true });

// Carrega páginas para o menu de navegação
async function getNavPages() {
  try {
    const [pages] = await db.query(
      "SELECT post_title,post_name FROM wp_posts WHERE post_type='page' AND post_status='publish' ORDER BY menu_order ASC, post_title ASC"
    );
    return pages;
  } catch { return []; }
}

// GET / — Homepage
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const [posts] = await db.query(
      "SELECT ID,post_title,post_name,post_excerpt,post_content,post_date FROM wp_posts WHERE post_type='post' AND post_status='publish' ORDER BY post_date DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    const [[{total}]] = await db.query("SELECT COUNT(*) total FROM wp_posts WHERE post_type='post' AND post_status='publish'");
    const navPages = await getNavPages();

    res.render('frontend/home', {
      pageTitle: null,
      posts,
      navPages,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.render('frontend/error', { pageTitle:'Erro', message: err.message, navPages:[] });
  }
});

// GET /post/:slug
router.get('/post/:slug', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM wp_posts WHERE post_name=? AND post_type='post' AND post_status='publish'",
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).render('frontend/404', { pageTitle:'404', navPages: await getNavPages() });
    const post = rows[0];
    const bodyHtml = marked(post.post_content || '');
    const navPages = await getNavPages();
    res.render('frontend/post', { pageTitle: post.post_title, post, bodyHtml, navPages });
  } catch (err) {
    res.render('frontend/error', { pageTitle:'Erro', message: err.message, navPages:[] });
  }
});

// GET /page/:slug
router.get('/page/:slug', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM wp_posts WHERE post_name=? AND post_type='page' AND post_status='publish'",
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).render('frontend/404', { pageTitle:'404', navPages: await getNavPages() });
    const page = rows[0];
    const bodyHtml = marked(page.post_content || '');
    const navPages = await getNavPages();
    res.render('frontend/page', { pageTitle: page.post_title, page, bodyHtml, navPages });
  } catch (err) {
    res.render('frontend/error', { pageTitle:'Erro', message: err.message, navPages:[] });
  }
});

// GET /api/nav-pages (mantido para compatibilidade)
router.get('/api/nav-pages', async (req, res) => {
  res.json(await getNavPages());
});

module.exports = router;
