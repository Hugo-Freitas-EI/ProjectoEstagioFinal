const express = require('express');
const router  = express.Router();

const { requireAuth } = require('../middleware/auth');
const Post             = require('../models/Post');
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

// ── main compare view ─────────────────────────────────────────────────────────

router.get('/admin/posts/:id/revisions/compare', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);

  const revisionsRaw = await Post.getRevisions(postId);

  // getRevisions devolve ORDER BY post_modified DESC (mais recente primeiro)
  // Invertemos para cronológico: índice 0 = mais antiga, índice N = mais recente
  const revisionsChron = (revisionsRaw || []).reverse().map(r => ({
    ...r,
    exactDateFormatted: formatExactDate(r.post_modified || r.post_date),
    timeAgo: timeAgo(r.post_modified || r.post_date)
  }));

  const total = revisionsChron.length;

  if (!total) {
    return res.render('admin/post-revisions-compare', {
      pageTitle: 'Revisões', currentPage: 'posts',
      postId, postTitle: `Post #${postId}`,
      revisions: [], leftId: 0, rightId: 0,
      leftRev: null, rightRev: null,
      titleDiff: null, contentDiff: null,
      compareMode: false, currentPos: 0,
      rightIsCurrentPost: false
    });
  }

  const compareMode = req.query.compare === '1';

  let leftId, rightId, currentPos, rightIsCurrentPost;

  if (compareMode) {
    leftId  = Number(req.query.left  || revisionsChron[0]?.ID || 0);
    rightId = Number(req.query.right || revisionsChron[total - 1]?.ID || 0);
    currentPos = total - 1;
    rightIsCurrentPost = false;
  } else {
    // slider: pos=0 = mais antiga (esquerda), pos=total-1 = mais recente (direita)
    currentPos = Math.max(0, Math.min(
      Number(req.query.pos ?? total - 1), // por defeito: posição mais à direita
      total - 1
    ));

    if (currentPos === total - 1) {
      // Posição mais à direita (mais recente):
      //   esquerda = última revisão guardada
      //   direita  = estado ATUAL do post (não é uma revisão, é o post em si)
      leftId  = Number(revisionsChron[currentPos]?.ID || 0);
      rightId = postId;          // sentinela — indica "post atual"
      rightIsCurrentPost = true;
    } else {
      // Posições intermédias: comparar revisão N com revisão N+1
      leftId  = Number(revisionsChron[currentPos]?.ID || 0);
      rightId = Number(revisionsChron[currentPos + 1]?.ID || 0);
      rightIsCurrentPost = false;
    }
  }

  // Buscar dados do lado esquerdo (sempre uma revisão)
  const leftRev = leftId ? await Post.getRevisionById(leftId) : null;

  // Buscar dados do lado direito (revisão ou post atual)
  let rightRev;
  if (rightIsCurrentPost) {
    const currentPost = await Post.findByIdWithAuthor(postId); // <- trocar aqui
    if (currentPost) {
      rightRev = {
        ...currentPost,
        author_name: currentPost.author_name || currentPost.username || null, // <- garante
        isCurrentPost: true
      };
    } else {
      rightRev = null;
    }
  } else {
    rightRev = rightId ? await Post.getRevisionById(rightId) : null;
  }

  const postInfo  = await Post.getPostTitleById(postId);
  const postTitle = postInfo?.post_title || `Post #${postId}`;

  const titleDiff   = buildSideBySideDiff(leftRev?.post_title,   rightRev?.post_title);
  const contentDiff = buildSideBySideDiff(leftRev?.post_content, rightRev?.post_content);

  res.render('admin/post-revisions-compare', {
    pageTitle: 'Comparar revisões', currentPage: 'posts',
    postId, postTitle,
    revisions: revisionsChron,
    leftId, rightId, leftRev, rightRev,
    titleDiff, contentDiff,
    compareMode, currentPos,
    rightIsCurrentPost
  });
});

// ── repor revisão ─────────────────────────────────────────────────────────────

router.post('/admin/posts/:id/revisions/:revId/restore', requireAuth, async (req, res) => {
  const { id, revId } = req.params;
  try {
    await Post.restoreRevision(Number(id), Number(revId));
    res.flash('success', 'Revisão reposta com sucesso.');
  } catch (err) {
    res.flash('error', 'Erro ao repor revisão: ' + err.message);
  }
  res.redirect(`/admin/posts/${id}/edit`);
});

module.exports = router;
