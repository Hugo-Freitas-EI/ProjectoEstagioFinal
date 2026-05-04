const express      = require('express');
const router       = express.Router();
const db           = require('../db');
const { marked }   = require('marked');
const PostType     = require('../models/PostType');
const PostMeta     = require('../models/PostMeta');
const SiteSetting  = require('../models/SiteSetting');

marked.setOptions({ breaks: true, gfm: true });

// Carrega páginas para o menu de navegação (fallback)
async function getNavPages() {
  try {
    const [pages] = await db.query(
      "SELECT post_title,post_name FROM wp_posts WHERE post_type='page' AND post_status='publish' ORDER BY menu_order ASC, post_title ASC"
    );
    return pages;
  } catch { return []; }
}

function buildMenuTree(items, parentId = null) {
  return items
    .filter(i => (i.parent_id ?? null) == parentId)
    .sort((a, b) => a.ordem - b.ordem)
    .map(i => ({ ...i, children: buildMenuTree(items, i.id) }));
}

async function getHeaderMenu() {
  try {
    const menuId = await SiteSetting.get('menu_location_header');
    if (!menuId) return null;
    const [items] = await db.query(
      'SELECT * FROM menu_itens WHERE menu_id = ? ORDER BY ordem ASC', [menuId]
    );
    return buildMenuTree(items);
  } catch { return null; }
}

// Injeta headerMenu em todos os pedidos frontend
router.use(async (req, res, next) => {
  res.locals.headerMenu = await getHeaderMenu();
  next();
});

// Busca termos de uma lista de IDs de posts — query única
async function getTermsForPosts(postIds) {
  if (!postIds.length) return {};
  const placeholders = postIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT pt.post_id, t.name, t.slug, c.name AS category_name, c.slug AS category_slug
     FROM post_terms pt
     JOIN terms t ON t.id = pt.term_id
     JOIN categories c ON c.id = t.category_id
     WHERE pt.post_id IN (${placeholders})
     ORDER BY c.name, t.name`,
    postIds
  );
  return rows.reduce((acc, r) => {
    if (!acc[r.post_id]) acc[r.post_id] = [];
    acc[r.post_id].push(r);
    return acc;
  }, {});
}

// ── GET / — Homepage ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page   = parseInt(req.query.page) || 1;
    const limit  = 10;
    const offset = (page - 1) * limit;

    const [posts] = await db.query(
      `SELECT p.ID, p.post_title, p.post_name, p.post_excerpt, p.post_content, p.post_date,
              r.username AS post_author_name
       FROM wp_posts p
       LEFT JOIN registers r ON p.post_author = r.id
       WHERE p.post_type='post' AND p.post_status='publish'
       ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) total FROM wp_posts WHERE post_type='post' AND post_status='publish'"
    );

    const termsByPost = await getTermsForPosts(posts.map(p => p.ID));
    const navPages    = await getNavPages();

    res.render('frontend/home', {
      pageTitle: null, posts, termsByPost, navPages,
      currentPage: page, totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.render('frontend/error', { pageTitle: 'Erro', message: err.message, navPages: [] });
  }
});

// ── GET /post/:slug ────────────────────────────────────────────────────────────
router.get('/post/:slug', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, r.username AS post_author_name
       FROM wp_posts p
       LEFT JOIN registers r ON p.post_author = r.id
       WHERE p.post_name = ? AND p.post_type = 'post' AND p.post_status = 'publish'`,
      [req.params.slug]
    );
    if (!rows.length) {
      return res.status(404).render('frontend/404', { pageTitle: '404', navPages: await getNavPages() });
    }

    const post     = rows[0];
    const bodyHtml = marked(post.post_content || '');
    const navPages = await getNavPages();
    const terms    = (await getTermsForPosts([post.ID]))[post.ID] || [];
    const meta     = await PostMeta.findByPost(post.ID);

    const [[prev]] = await db.query(
      "SELECT ID, post_title, post_name FROM wp_posts WHERE post_type='post' AND post_status='publish' AND post_date < ? ORDER BY post_date DESC LIMIT 1",
      [post.post_date]
    );
    const [[next]] = await db.query(
      "SELECT ID, post_title, post_name FROM wp_posts WHERE post_type='post' AND post_status='publish' AND post_date > ? ORDER BY post_date ASC LIMIT 1",
      [post.post_date]
    );

    res.render('frontend/post', {
      pageTitle: post.post_title, metaDesc: post.post_excerpt,
      post, bodyHtml, navPages, terms, meta,
      prev: prev || null, next: next || null
    });
  } catch (err) {
    res.render('frontend/error', { pageTitle: 'Erro', message: err.message, navPages: [] });
  }
});

// ── GET /page/:slug ────────────────────────────────────────────────────────────
router.get('/page/:slug', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM wp_posts WHERE post_name=? AND post_type='page' AND post_status='publish'",
      [req.params.slug]
    );
    if (!rows.length) {
      return res.status(404).render('frontend/404', { pageTitle: '404', navPages: await getNavPages() });
    }
    const page     = rows[0];
    const bodyHtml = marked(page.post_content || '');
    const navPages = await getNavPages();
    res.render('frontend/page', { pageTitle: page.post_title, page, bodyHtml, navPages });
  } catch (err) {
    res.render('frontend/error', { pageTitle: 'Erro', message: err.message, navPages: [] });
  }
});

// ── GET /category/:slug — arquivo de categoria/taxonomia ──────────────────────
router.get('/category/:slug', async (req, res) => {
  try {
    const [[category]] = await db.query(
      'SELECT * FROM categories WHERE slug = ?', [req.params.slug]
    );
    if (!category) {
      return res.status(404).render('frontend/404', { pageTitle: '404', navPages: await getNavPages() });
    }

    const page   = parseInt(req.query.page) || 1;
    const limit  = 10;
    const offset = (page - 1) * limit;

    const [posts] = await db.query(
      `SELECT DISTINCT p.ID, p.post_title, p.post_name, p.post_excerpt, p.post_content,
              p.post_date, p.post_type, r.username AS post_author_name
       FROM wp_posts p
       LEFT JOIN registers r ON p.post_author = r.id
       JOIN post_terms pt ON pt.post_id = p.ID
       JOIN terms t ON t.id = pt.term_id
       WHERE t.category_id = ? AND p.post_status = 'publish'
       ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
      [category.id, limit, offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT p.ID) total
       FROM wp_posts p
       JOIN post_terms pt ON pt.post_id = p.ID
       JOIN terms t ON t.id = pt.term_id
       WHERE t.category_id = ? AND p.post_status = 'publish'`,
      [category.id]
    );

    const termsByPost = await getTermsForPosts(posts.map(p => p.ID));
    const navPages    = await getNavPages();

    res.render('frontend/category-archive', {
      pageTitle: category.name, category, posts, termsByPost, navPages,
      currentPage: page, totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.render('frontend/error', { pageTitle: 'Erro', message: err.message, navPages: [] });
  }
});

// ── GET /:postType — arquivo de CPT ───────────────────────────────────────────
router.get('/:postType', async (req, res, next) => {
  try {
    const pt = await PostType.findByName(req.params.postType);
    if (!pt || pt.system) return next(); // não é CPT personalizado

    const page   = parseInt(req.query.page) || 1;
    const limit  = 12;
    const offset = (page - 1) * limit;

    const [posts] = await db.query(
      `SELECT p.ID, p.post_title, p.post_name, p.post_excerpt, p.post_content, p.post_date,
              r.username AS post_author_name
       FROM wp_posts p
       LEFT JOIN registers r ON p.post_author = r.id
       WHERE p.post_type = ? AND p.post_status = 'publish'
       ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
      [pt.name, limit, offset]
    );

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) total FROM wp_posts WHERE post_type = ? AND post_status = 'publish'",
      [pt.name]
    );

    const termsByPost = await getTermsForPosts(posts.map(p => p.ID));
    const navPages    = await getNavPages();

    res.render('frontend/cpt-archive', {
      pageTitle: pt.label,
      postType: pt,
      posts,
      termsByPost,
      navPages,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.render('frontend/error', { pageTitle: 'Erro', message: err.message, navPages: [] });
  }
});

// ── GET /:postType/:slug — single CPT ─────────────────────────────────────────
router.get('/:postType/:slug', async (req, res, next) => {
  try {
    const pt = await PostType.findByName(req.params.postType);
    if (!pt || pt.system) return next();

    const [rows] = await db.query(
      `SELECT p.*, r.username AS post_author_name
       FROM wp_posts p
       LEFT JOIN registers r ON p.post_author = r.id
       WHERE p.post_name = ? AND p.post_type = ? AND p.post_status = 'publish'`,
      [req.params.slug, pt.name]
    );
    if (!rows.length) {
      return res.status(404).render('frontend/404', { pageTitle: '404', navPages: await getNavPages() });
    }

    const post     = rows[0];
    const bodyHtml = marked(post.post_content || '');
    const navPages = await getNavPages();
    const terms    = (await getTermsForPosts([post.ID]))[post.ID] || [];
    const meta     = await PostMeta.findByPost(post.ID);

    const [[prevPost]] = await db.query(
      "SELECT ID, post_title, post_name FROM wp_posts WHERE post_type=? AND post_status='publish' AND post_date < ? ORDER BY post_date DESC LIMIT 1",
      [pt.name, post.post_date]
    );
    const [[nextPost]] = await db.query(
      "SELECT ID, post_title, post_name FROM wp_posts WHERE post_type=? AND post_status='publish' AND post_date > ? ORDER BY post_date ASC LIMIT 1",
      [pt.name, post.post_date]
    );

    res.render('frontend/cpt-single', {
      pageTitle: post.post_title,
      metaDesc: post.post_excerpt,
      postType: pt,
      post, bodyHtml, navPages, terms, meta,
      prev: prevPost || null, next: nextPost || null
    });
  } catch (err) {
    res.render('frontend/error', { pageTitle: 'Erro', message: err.message, navPages: [] });
  }
});

// GET /api/nav-pages (mantido para compatibilidade)
router.get('/api/nav-pages', async (req, res) => {
  res.json(await getNavPages());
});

module.exports = router;
