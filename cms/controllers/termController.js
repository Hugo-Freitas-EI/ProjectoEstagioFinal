const TaxonomyService = require('../services/taxonomyService');
const Category        = require('../models/Category');
const Term            = require('../models/Term');

const TermController = {

  async list(req, res) {
    const { category_id } = req.query;
    const terms      = await TaxonomyService.listTerms(category_id || null);
    const categories = await Category.findAll();
    res.render('admin/terms/index', {
      pageTitle: 'Termos', currentPage: 'terms',
      terms, categories, filterCategoryId: category_id || ''
    });
  },

  async newForm(req, res) {
    const categories = await Category.findAll();
    res.render('admin/terms/form', {
      pageTitle: 'Novo Termo', currentPage: 'terms',
      term: null, categories, isEdit: false, error: null,
      preselectedCategoryId: req.query.category_id || ''
    });
  },

  async create(req, res) {
    const { name, slug, description, category_id } = req.body;
    if (!name?.trim() || !category_id) {
      const categories = await Category.findAll();
      return res.render('admin/terms/form', {
        pageTitle: 'Novo Termo', currentPage: 'terms',
        term: req.body, categories, isEdit: false,
        error: 'Nome e categoria são obrigatórios.',
        preselectedCategoryId: category_id || ''
      });
    }
    try {
      await TaxonomyService.createTerm({ name: name.trim(), slug, description, categoryId: category_id, userId: req.user?.id });
      res.flash('success', 'Termo criado.');
      res.redirect('/admin/terms');
    } catch (err) {
      const categories = await Category.findAll();
      res.render('admin/terms/form', {
        pageTitle: 'Novo Termo', currentPage: 'terms',
        term: req.body, categories, isEdit: false,
        error: err.message, preselectedCategoryId: category_id || ''
      });
    }
  },

  async editForm(req, res) {
    const term = await Term.findById(req.params.id);
    if (!term) return res.redirect('/admin/terms');
    const categories = await Category.findAll();
    res.render('admin/terms/form', {
      pageTitle: 'Editar Termo', currentPage: 'terms',
      term, categories, isEdit: true, error: null,
      preselectedCategoryId: term.category_id
    });
  },

  async update(req, res) {
    const { name, slug, description, category_id } = req.body;
    try {
      await TaxonomyService.updateTerm(req.params.id, { name, slug, description, categoryId: category_id, userId: req.user?.id });
      res.flash('success', 'Termo atualizado.');
      res.redirect('/admin/terms');
    } catch (err) {
      res.flash('error', err.message);
      res.redirect('/admin/terms/' + req.params.id + '/edit');
    }
  },

  async destroy(req, res) {
    await TaxonomyService.deleteTerm(req.params.id);
    res.flash('success', 'Termo apagado.');
    res.redirect('/admin/terms');
  }
};

module.exports = TermController;
