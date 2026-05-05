const PostService     = require('../services/postService');
const TaxonomyService = require('../services/taxonomyService');
const PostType        = require('../models/PostType');
const Post            = require('../models/Post');

function extractMeta(body) {
  const meta = {};
  for (const [key, val] of Object.entries(body)) {
    if (key.startsWith('meta_')) meta[key.replace('meta_', '')] = val;
  }
  return meta;
}

// Devolve o label legível de um postType
async function getPostTypeLabel(name) {
  const pt = await PostType.findByName(name);
  return pt?.label || name;
}

// Devolve as taxonomias (categories) associadas ao postType
// Para post/page usa todas; para CPTs só as associadas
async function getRelevantTerms(postTypeName) {
  const systemTypes = ['post', 'page'];
  if (systemTypes.includes(postTypeName)) {
    return TaxonomyService.listTerms();
  }
  const taxonomies = await PostType.getTaxonomies(postTypeName);
  if (!taxonomies.length) return [];
  const { Term } = require('../models/Term') || require('../models/Term');
  // buscar termos de cada taxonomia associada
  const Term2 = require('../models/Term');
  const allTerms = [];
  for (const cat of taxonomies) {
    const terms = await Term2.findAll({ categoryId: cat.id });
    allTerms.push(...terms);
  }
  return allTerms;
}

const PostController = {

  async list(req, res) {
    const postType = req.basePostType || 'post';
    const label    = await getPostTypeLabel(postType);
    const { status = 'all', search = '', page = 1 } = req.query;
    const authorId = req.user.ownContentOnly ? req.user.id : null;

    const result = await PostService.list(postType, {
      status: status === 'all' ? null : status,
      search, page: Number(page), limit: 20, authorId
    });

    res.render('admin/posts-list', {
      pageTitle: label,
      currentPage: postType,
      ...result,
      postType, status, search,
      pagination: { current: Number(page), total: Math.ceil(result.total / 20) }
    });
  },

  async newForm(req, res) {
    const postType = req.basePostType || 'post';
    const label    = await getPostTypeLabel(postType);
    const allTerms = await getRelevantTerms(postType);
    const fieldGroups = await PostService.getEditorData(postType);

    res.render('admin/post-editor', {
      pageTitle: `Novo ${label}`,
      currentPage: postType,
      post: null, postType, isEdit: false, error: null,
      formAction: `/admin/cpt/${postType}`,
      allTerms, selectedTermIds: [], fieldGroups, revisions: []
    });
  },

  async create(req, res) {
    const postType = req.basePostType || 'post';
    const label    = await getPostTypeLabel(postType);
    const { post_title, post_content, post_excerpt, post_name, post_date, action } = req.body;
    const status   = action === 'publish' ? 'publish' : 'draft';
    const termIds  = [].concat(req.body.term_ids || []);
    const meta     = extractMeta(req.body);

    if (!post_title?.trim()) {
      const allTerms    = await getRelevantTerms(postType);
      const fieldGroups = await PostService.getEditorData(postType);
      return res.render('admin/post-editor', {
        pageTitle: `Novo ${label}`, currentPage: postType,
        post: req.body, postType, isEdit: false,
        error: 'O título é obrigatório.',
        formAction: `/admin/cpt/${postType}`,
        allTerms, selectedTermIds: termIds, fieldGroups, revisions: []
      });
    }

    try {
      const id = await PostService.create(req.user.id, {
        title: post_title.trim(), content: post_content || '',
        excerpt: post_excerpt || '', slug: post_name || '',
        status, postType, date: post_date, termIds, meta
      });
      res.flash('success', status === 'publish' ? 'Publicado!' : 'Rascunho guardado.');
      res.redirect(`/admin/cpt/${postType}/${id}/edit`);
    } catch (err) {
      console.error(err);
      res.flash('error', 'Erro ao guardar: ' + err.message);
      res.redirect(`/admin/cpt/${postType}/new`);
    }
  },

  async editForm(req, res) {
    const postType = req.basePostType || 'post';
    const label    = await getPostTypeLabel(postType);
    const post     = await PostService.getWithFullData(req.params.id);
    if (!post) return res.redirect(`/admin/cpt/${postType}`);
    if (req.user.ownContentOnly && post.post_author !== req.user.id) {
      res.flash('error', 'Não tens permissão para editar este conteúdo.');
      return res.redirect(`/admin/cpt/${postType}`);
    }

    const allTerms       = await getRelevantTerms(postType);
    const selectedTermIds = post.terms.map(t => t.id);
    const fieldGroups    = await PostService.getEditorData(post.post_type, post.ID);

    // Revisões
    const rawRevisions = await Post.getRevisions(post.ID);
    const now          = new Date();
    const fmt          = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' });
    const revisions    = rawRevisions.map(rev => {
      const d       = new Date(rev.post_modified);
      const diffH   = Math.round((d - now) / 3600000);
      const diffD   = Math.round((d - now) / 86400000);
      const timeAgo = Math.abs(diffH) < 24 ? fmt.format(diffH, 'hour') : fmt.format(diffD, 'day');
      const exact   = d.toLocaleDateString('pt-PT', { day:'numeric', month:'long', year:'numeric' })
                    + ' @ ' + d.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      return { ...rev, timeAgo, exactDateFormatted: exact, isAutoSave: rev.post_name.includes('autosave') };
    });

    // URL pública do post consoante o tipo
    let viewUrl = null;
    if (post.post_status === 'publish' && post.post_name) {
      if (post.post_type === 'post')        viewUrl = `/post/${post.post_name}`;
      else if (post.post_type === 'page')   viewUrl = `/page/${post.post_name}`;
      else                                  viewUrl = `/${post.post_type}/${post.post_name}`;
    }

    res.render('admin/post-editor', {
      pageTitle: `Editar ${label}`,
      currentPage: postType,
      post, postId: post.ID, postType: post.post_type,
      isEdit: true, error: null,
      formAction: `/admin/cpt/${postType}/${post.ID}`,
      allTerms, selectedTermIds, fieldGroups, revisions,
      viewUrl
    });
  },

  async update(req, res) {
    const postType = req.basePostType || 'post';
    const { id }   = req.params;

    if (req.user.ownContentOnly) {
      const existing = await Post.findById(id);
      if (!existing || existing.post_author !== req.user.id) {
        res.flash('error', 'Não tens permissão para editar este conteúdo.');
        return res.redirect(`/admin/cpt/${postType}`);
      }
    }

    const { post_title, post_content, post_excerpt, post_name, post_date, action } = req.body;
    const status   = action === 'publish' ? 'publish' : 'draft';
    const termIds  = [].concat(req.body.term_ids || []);
    const meta     = extractMeta(req.body);

    try {
      await PostService.update(id, {
        title: (post_title || '').trim(),
        content: (post_content || '').trim(),
        excerpt: post_excerpt || '',
        slug: post_name || '',
        status, date: post_date, termIds, meta
      });
      res.flash('success', status === 'publish' ? 'Publicado!' : 'Rascunho guardado.');
      res.redirect(`/admin/cpt/${postType}/${id}/edit`);
    } catch (err) {
      console.error(err);
      res.flash('error', 'Erro: ' + err.message);
      res.redirect(`/admin/cpt/${postType}/${id}/edit`);
    }
  },

  async destroy(req, res) {
    const postType = req.basePostType || 'post';

    if (req.user.ownContentOnly) {
      const existing = await Post.findById(req.params.id);
      if (!existing || existing.post_author !== req.user.id) {
        res.flash('error', 'Não tens permissão para apagar este conteúdo.');
        return res.redirect(`/admin/cpt/${postType}`);
      }
    }

    await PostService.delete(req.params.id);
    res.flash('success', 'Apagado com sucesso.');
    res.redirect(`/admin/cpt/${postType}`);
  }
};

module.exports = PostController;
