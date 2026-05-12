const PostType = require('../models/PostType');
const Category = require('../models/Category');

// Converte label em identificador (usa _ para nomes de BD)
function makeId(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const PostTypeController = {

  async list(req, res) {
    const custom = await PostType.findAll();
    for (const pt of custom) {
      pt.postCount = await PostType.countPosts(pt.name);
      pt.taxonomies = await PostType.getTaxonomies(pt.name);
    }
    const systemTypes = await Promise.all(
      PostType.SYSTEM.map(async s => ({ ...s, taxonomies: await PostType.getTaxonomies(s.name) }))
    );
    res.render('admin/post-types/index', {
      pageTitle: 'Tipos de Conteúdo', currentPage: 'post-types',
      postTypes: custom, systemTypes
    });
  },

  async newForm(req, res) {
    const categories = await Category.findAll();
    res.render('admin/post-types/form', {
      pageTitle: 'Novo Tipo de Conteúdo', currentPage: 'post-types',
      postType: null, isEdit: false, isSystem: false, error: null, categories,
      selectedCategoryIds: []
    });
  },

  async create(req, res) {
    const { label, name, description, category_ids } = req.body;
    if (!label?.trim()) {
      const categories = await Category.findAll();
      return res.render('admin/post-types/form', {
        pageTitle: 'Novo Tipo de Conteúdo', currentPage: 'post-types',
        postType: req.body, isEdit: false, isSystem: false, error: 'O label é obrigatório.',
        categories, selectedCategoryIds: [].concat(category_ids || [])
      });
    }
    const finalName = (name || '').trim() || makeId(label);
    try {
      await PostType.create({ name: finalName, label: label.trim(), description, createdBy: req.user?.id });
      await PostType.syncTaxonomies(finalName, [].concat(category_ids || []).filter(Boolean));
      res.flash('success', 'Tipo de conteúdo criado. Já aparece na sidebar.');
      res.redirect('/admin/post-types');
    } catch (err) {
      const categories = await Category.findAll();
      res.render('admin/post-types/form', {
        pageTitle: 'Novo Tipo de Conteúdo', currentPage: 'post-types',
        postType: req.body, isEdit: false, isSystem: false, error: err.message,
        categories, selectedCategoryIds: [].concat(category_ids || [])
      });
    }
  },

  async editForm(req, res) {
    const pt = await PostType.findByName(req.params.name);
    if (!pt) return res.redirect('/admin/post-types');
    const categories = await Category.findAll();
    const selectedCategoryIds = (await PostType.getTaxonomies(pt.name)).map(c => c.id);
    res.render('admin/post-types/form', {
      pageTitle: 'Editar Tipo de Conteúdo', currentPage: 'post-types',
      postType: pt, isEdit: true, isSystem: !!pt.system, error: null, categories, selectedCategoryIds
    });
  },

  async update(req, res) {
    const { label, description, category_ids } = req.body;
    const ptName = req.params.name;
    const pt = await PostType.findByName(ptName);
    if (!pt) return res.redirect('/admin/post-types');
    try {
      if (!pt.system) {
        await PostType.update(pt.id, { label, description, updatedBy: req.user?.id });
      }
      await PostType.syncTaxonomies(ptName, [].concat(category_ids || []).filter(Boolean));
      res.flash('success', pt.system ? 'Taxonomias atualizadas.' : 'Tipo de conteúdo atualizado.');
      res.redirect('/admin/post-types');
    } catch (err) {
      res.flash('error', err.message);
      res.redirect(`/admin/post-types/${ptName}/edit`);
    }
  },

  async destroy(req, res) {
    const pt = await PostType.findByName(req.params.name);
    if (!pt || pt.system) {
      res.flash('error', 'Não é possível apagar tipos de sistema.');
      return res.redirect('/admin/post-types');
    }
    await PostType.delete(pt.id);
    res.flash('success', 'Tipo de conteúdo desativado.');
    res.redirect('/admin/post-types');
  }
};

module.exports = PostTypeController;
