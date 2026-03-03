const TaxonomyService = require('../services/taxonomyService');

const CategoryController = {

  async list(req, res) {
    const categories = await TaxonomyService.listCategories();
    res.render('admin/categories/index', {
      pageTitle: 'Categorias', currentPage: 'categories', categories
    });
  },

  async newForm(req, res) {
    res.render('admin/categories/form', {
      pageTitle: 'Nova Categoria', currentPage: 'categories',
      category: null, isEdit: false, error: null
    });
  },

  async create(req, res) {
    const { name, slug, description } = req.body;
    if (!name?.trim()) {
      return res.render('admin/categories/form', {
        pageTitle: 'Nova Categoria', currentPage: 'categories',
        category: req.body, isEdit: false, error: 'O nome é obrigatório.'
      });
    }
    try {
      await TaxonomyService.createCategory({ name: name.trim(), slug, description });
      res.flash('success', 'Categoria criada.');
      res.redirect('/admin/categories');
    } catch (err) {
      res.render('admin/categories/form', {
        pageTitle: 'Nova Categoria', currentPage: 'categories',
        category: req.body, isEdit: false, error: err.message
      });
    }
  },

  async editForm(req, res) {
    const cat = await require('../models/Category').findById(req.params.id);
    if (!cat) return res.redirect('/admin/categories');
    res.render('admin/categories/form', {
      pageTitle: 'Editar Categoria', currentPage: 'categories',
      category: cat, isEdit: true, error: null
    });
  },

  async update(req, res) {
    const { name, slug, description } = req.body;
    if (!name?.trim()) {
      return res.render('admin/categories/form', {
        pageTitle: 'Editar Categoria', currentPage: 'categories',
        category: { ...req.body, id: req.params.id }, isEdit: true, error: 'O nome é obrigatório.'
      });
    }
    try {
      await TaxonomyService.updateCategory(req.params.id, { name: name.trim(), slug, description });
      res.flash('success', 'Categoria atualizada.');
      res.redirect('/admin/categories');
    } catch (err) {
      res.flash('error', err.message);
      res.redirect('/admin/categories/' + req.params.id + '/edit');
    }
  },

  async destroy(req, res) {
    try {
      await TaxonomyService.deleteCategory(req.params.id);
      res.flash('success', 'Categoria apagada.');
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/categories');
  }
};

module.exports = CategoryController;
