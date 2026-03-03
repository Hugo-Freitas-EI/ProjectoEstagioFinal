const PostService    = require('../services/postService');
const TaxonomyService = require('../services/taxonomyService');

// Helper: extrai campos meta do body (prefixo "meta_")
function extractMeta(body) {
  const meta = {};
  for (const [key, val] of Object.entries(body)) {
    if (key.startsWith('meta_')) {
      meta[key.replace('meta_', '')] = val;
    }
  }
  return meta;
}

const PostController = {

  // GET /admin/posts  |  GET /admin/pages
  async list(req, res) {
    const postType = req.basePostType || 'post';
    const { status = 'all', search = '', page = 1 } = req.query;
    const result = await PostService.list(postType, {
      status: status === 'all' ? null : status,
      search, page: Number(page), limit: 20
    });
    res.render('admin/posts-list', {
      pageTitle: postType === 'page' ? 'Páginas' : 'Posts',
      currentPage: postType === 'page' ? 'pages' : 'posts',
      ...result,
      postType, status, search,
      pagination: { current: Number(page), total: Math.ceil(result.total / 20) }
    });
  },

  // GET /admin/posts/new
  async newForm(req, res) {
    const postType = req.basePostType || 'post';
    const allTerms = await TaxonomyService.listTerms();
    const fieldGroups = await PostService.getEditorData(postType);
    res.render('admin/post-editor', {
      pageTitle: postType === 'page' ? 'Nova Página' : 'Novo Post',
      currentPage: postType === 'page' ? 'pages' : 'posts',
      post: null, postType, isEdit: false, error: null,
      formAction: `/admin/${postType === 'page' ? 'pages' : 'posts'}`,
      allTerms, selectedTermIds: [], fieldGroups
    });
  },

  // POST /admin/posts
  async create(req, res) {
    const postType = req.basePostType || 'post';
    const { post_title, post_content, post_excerpt, post_name, post_date, action } = req.body;
    const status = action === 'publish' ? 'publish' : 'draft';
    const termIds = [].concat(req.body.term_ids || []);
    const meta = extractMeta(req.body);

    if (!post_title?.trim()) {
      const allTerms = await TaxonomyService.listTerms();
      const fieldGroups = await PostService.getEditorData(postType);
      return res.render('admin/post-editor', {
        pageTitle: 'Novo Post', currentPage: postType === 'page' ? 'pages' : 'posts',
        post: req.body, postType, isEdit: false, error: 'O título é obrigatório.',
        formAction: `/admin/${postType === 'page' ? 'pages' : 'posts'}`,
        allTerms, selectedTermIds: termIds, fieldGroups
      });
    }

    try {
      const id = await PostService.create(req.user.id, {
        title: post_title.trim(), content: post_content || '',
        excerpt: post_excerpt || '', slug: post_name || '',
        status, postType, date: post_date, termIds, meta
      });
      res.flash('success', status === 'publish' ? 'Publicado com sucesso!' : 'Rascunho guardado.');
      res.redirect(`/admin/${postType === 'page' ? 'pages' : 'posts'}/${id}/edit`);
    } catch (err) {
      console.error(err);
      res.flash('error', 'Erro ao guardar: ' + err.message);
      res.redirect(`/admin/${postType === 'page' ? 'pages' : 'posts'}/new`);
    }
  },

  // GET /admin/posts/:id/edit
  async editForm(req, res) {
    const postType = req.basePostType || 'post';
    const post = await PostService.getWithFullData(req.params.id);
    if (!post) return res.redirect(`/admin/${postType === 'page' ? 'pages' : 'posts'}`);

    const allTerms = await TaxonomyService.listTerms();
    const selectedTermIds = post.terms.map(t => t.id);
    const fieldGroups = await PostService.getEditorData(post.post_type, post.ID);

    res.render('admin/post-editor', {
      pageTitle: `Editar ${postType === 'page' ? 'Página' : 'Post'}`,
      currentPage: postType === 'page' ? 'pages' : 'posts',
      post, postType: post.post_type, isEdit: true, error: null,
      formAction: `/admin/${postType === 'page' ? 'pages' : 'posts'}/${post.ID}`,
      allTerms, selectedTermIds, fieldGroups
    });
  },

  // POST /admin/posts/:id
  async update(req, res) {
    const postType = req.basePostType || 'post';
    const { id } = req.params;
    const { post_title, post_content, post_excerpt, post_name, post_date, action } = req.body;
    const status = action === 'publish' ? 'publish' : 'draft';
    const termIds = [].concat(req.body.term_ids || []);
    const meta = extractMeta(req.body);

    try {
      await PostService.update(id, {
        title: (post_title || '').trim(), content: post_content || '',
        excerpt: post_excerpt || '', slug: post_name || '',
        status, date: post_date, termIds, meta
      });
      res.flash('success', status === 'publish' ? 'Publicado!' : 'Rascunho guardado.');
      res.redirect(`/admin/${postType === 'page' ? 'pages' : 'posts'}/${id}/edit`);
    } catch (err) {
      console.error(err);
      res.flash('error', 'Erro: ' + err.message);
      res.redirect(`/admin/${postType === 'page' ? 'pages' : 'posts'}/${id}/edit`);
    }
  },

  // POST /admin/posts/:id/delete
  async destroy(req, res) {
    const postType = req.basePostType || 'post';
    await PostService.delete(req.params.id);
    res.flash('success', 'Apagado com sucesso.');
    res.redirect(`/admin/${postType === 'page' ? 'pages' : 'posts'}`);
  }
};

module.exports = PostController;
