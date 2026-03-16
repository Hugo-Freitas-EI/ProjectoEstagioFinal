const express = require('express');
const router  = express.Router();

const { requireAuth } = require('../middleware/auth');
const Post = require('../models/Post');
const { diffWordsWithSpace } = require('diff');

// ── helpers ──────────────────────────────────────────────────────────────────

function formatExactDate(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt ?? '');
  return d.toLocaleString('pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const sec  = Math.floor(diff / 1000);
  const min  = Math.floor(sec / 60);
  const h    = Math.floor(min / 60);
  const day  = Math.floor(h / 24);
  if (day > 0)  return `Há ${day} dia${day  > 1 ? 's' : ''}`;
  if (h   > 0)  return `Há ${h} hora${h    > 1 ? 's' : ''}`;
  if (min > 0)  return `Há ${min} minuto${min > 1 ? 's' : ''}`;
  return 'Agora mesmo';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildSideBySideDiff(oldStr, newStr) {
  const parts = diffWordsWithSpace(String(oldStr ?? ''), String(newStr ?? ''));

  const left = parts
    .filter(p => !p.added)
    .map(p => {
      const val = escapeHtml(p.value);
      return p.removed ? `<del class="diff-del">${val}</del>` : val;
    })
    .join('');

  const right = parts
    .filter(p => !p.removed)
    .map(p => {
      const val = escapeHtml(p.value);
      return p.added ? `<ins class="diff-ins">${val}</ins>` : val;
    })
    .join('');

  const hasChanges = parts.some(p => p.added || p.removed);
  return {
    left:  hasChanges ? left  : escapeHtml(String(oldStr ?? '')),
    right: hasChanges ? right : escapeHtml(String(newStr ?? '')),
    hasChanges
  };
}

// ── redirect ──────────────────────────────────────────────────────────────────

router.get('/admin/posts/:id/revisions', requireAuth, (req, res) => {
  res.redirect(`/admin/posts/${req.params.id}/revisions/compare`);
});

router.get('/admin/pages/:id/revisions', requireAuth, (req, res) => {
  res.redirect(`/admin/pages/${req.params.id}/revisions/compare`);
});

// ── main compare view ─────────────────────────────────────────────────────────

router.get('/admin/:section(posts|pages)/:id/revisions/compare', requireAuth, async (req, res) => {
  const postId  = Number(req.params.id);
  const section = req.params.section; // 'posts' | 'pages'

  const revisionsRaw = await Post.getRevisions(postId);

  const revisionsChron = (revisionsRaw || [])
    .slice()
    .sort((a, b) => {
      const da = new Date(a.post_modified || a.post_date).getTime() || 0;
      const db = new Date(b.post_modified || b.post_date).getTime() || 0;
      return da - db;
    })
    .map(r => ({
      ...r,
      exactDateFormatted: formatExactDate(r.post_modified || r.post_date),
      timeAgo: timeAgo(r.post_modified || r.post_date)
    }));

  const total = revisionsChron.length;

  const base = `/admin/${section}/${postId}/revisions/compare`;
  const editUrl = `/admin/${section}/${postId}/edit`;
  const restoreBase = `/admin/${section}/${postId}/revisions`;

  if (!total) {
    return res.render('admin/post-revisions-compare', {
      pageTitle: 'Revisões',
      currentPage: section === 'pages' ? 'pages' : 'posts',
      base,
      editUrl,
      restoreBase,
      postId,
      postTitle: `${section === 'pages' ? 'Página' : 'Post'} #${postId}`,
      revisions: [],
      leftId: 0,
      rightId: 0,
      leftRev: null,
      rightRev: null,
      titleDiff: null,
      contentDiff: null,
      compareMode: false,
      currentPos: 0,
      rightIsCurrentPost: false
    });
  }

  const compareMode = req.query.compare === '1';

  let leftId, rightId, currentPos, rightIsCurrentPost;

  if (compareMode) {
    leftId  = Number(req.query.left  || (revisionsChron[0]?.ID || revisionsChron[0]?.id) || 0);
    rightId = Number(req.query.right || (revisionsChron[total - 1]?.ID || revisionsChron[total - 1]?.id) || 0);
    currentPos = total - 1;
    rightIsCurrentPost = false;
  } else {
    currentPos = Math.max(0, Math.min(Number(req.query.pos ?? total - 1), total - 1));

    if (currentPos === total - 1) {
      leftId  = Number(revisionsChron[currentPos]?.ID || revisionsChron[currentPos]?.id || 0);
      rightId = postId; // sentinela
      rightIsCurrentPost = true;
    } else {
      leftId  = Number(revisionsChron[currentPos]?.ID || revisionsChron[currentPos]?.id || 0);
      rightId = Number(revisionsChron[currentPos + 1]?.ID || revisionsChron[currentPos + 1]?.id || 0);
      rightIsCurrentPost = false;
    }
  }

  const leftRev = leftId ? await Post.getRevisionById(leftId) : null;

  let rightRev;
  if (rightIsCurrentPost) {
    const currentPost = await Post.findByIdWithAuthor(postId);
    rightRev = currentPost
      ? { ...currentPost, author_name: currentPost.author_name || currentPost.username || null, isCurrentPost: true }
      : null;
  } else {
    rightRev = rightId ? await Post.getRevisionById(rightId) : null;
  }

  const postInfo  = await Post.getPostTitleById(postId);
  const postTitle = postInfo?.post_title || `${section === 'pages' ? 'Página' : 'Post'} #${postId}`;

  const titleDiff   = buildSideBySideDiff(leftRev?.post_title,   rightRev?.post_title);
  const contentDiff = buildSideBySideDiff(leftRev?.post_content, rightRev?.post_content);

  return res.render('admin/post-revisions-compare', {
    pageTitle: 'Comparar revisões',
    currentPage: section === 'pages' ? 'pages' : 'posts',
    base,
    editUrl,
    restoreBase,
    postId,
    postTitle,
    revisions: revisionsChron,
    leftId,
    rightId,
    leftRev,
    rightRev,
    titleDiff,
    contentDiff,
    compareMode,
    currentPos,
    rightIsCurrentPost
  });
});

// Restore (posts e pages)
router.post('/admin/:section(posts|pages)/:id/revisions/:revId/restore', requireAuth, async (req, res) => {
  const { section, id, revId } = req.params;
  try {
    await Post.restoreRevision(Number(id), Number(revId));
    res.flash('success', 'Revisão reposta com sucesso.');
  } catch (err) {
    res.flash('error', 'Erro ao repor revisão: ' + err.message);
  }
  res.redirect(`/admin/${section}/${id}/edit`);
});

module.exports = router;
