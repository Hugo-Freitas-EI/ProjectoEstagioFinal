const FieldService = require('../services/fieldService');
const PostType     = require('../models/PostType');

const FieldGroupController = {

  async list(req, res) {
    const groups = await FieldService.listGroups();
    res.render('admin/field-groups/index', {
      pageTitle: 'Custom Fields', currentPage: 'field-groups', groups
    });
  },

  async newForm(req, res) {
    const allPostTypes = await PostType.findAllWithSystem();
    res.render('admin/field-groups/form', {
      pageTitle: 'Novo Grupo de Campos', currentPage: 'field-groups',
      group: null, isEdit: false, error: null,
      fieldTypes: FieldService.getFieldTypes(),
      allPostTypes
    });
  },

  async create(req, res) {
    const { name, post_type } = req.body;
    if (!name?.trim() || !post_type?.trim()) {
      const allPostTypes = await PostType.findAllWithSystem();
      return res.render('admin/field-groups/form', {
        pageTitle: 'Novo Grupo de Campos', currentPage: 'field-groups',
        group: req.body, isEdit: false, error: 'Nome e post type são obrigatórios.',
        fieldTypes: FieldService.getFieldTypes(), allPostTypes
      });
    }
    try {
      const id = await FieldService.createGroup({ name: name.trim(), postType: post_type.trim() });
      res.flash('success', 'Grupo criado.');
      res.redirect('/admin/field-groups/' + id + '/edit');
    } catch (err) {
      res.flash('error', err.message);
      res.redirect('/admin/field-groups/new');
    }
  },

  async editForm(req, res) {
    const group = await FieldService.getGroup(req.params.id);
    if (!group) return res.redirect('/admin/field-groups');
    const allPostTypes = await PostType.findAllWithSystem();
    res.render('admin/field-groups/form', {
      pageTitle: 'Editar Grupo de Campos', currentPage: 'field-groups',
      group, isEdit: true, error: null,
      fieldTypes: FieldService.getFieldTypes(),
      allPostTypes
    });
  },

  async update(req, res) {
    const { name, post_type } = req.body;
    try {
      await FieldService.updateGroup(req.params.id, { name, postType: post_type });
      res.flash('success', 'Grupo atualizado.');
      res.redirect('/admin/field-groups/' + req.params.id + '/edit');
    } catch (err) {
      res.flash('error', err.message);
      res.redirect('/admin/field-groups/' + req.params.id + '/edit');
    }
  },

  async destroy(req, res) {
    await FieldService.deleteGroup(req.params.id);
    res.flash('success', 'Grupo e todos os campos apagados.');
    res.redirect('/admin/field-groups');
  },

  // ── CAMPOS ────────────────────────────────────────────────────────────────

  async addField(req, res) {
    const { label, name, type } = req.body;
    if (!label?.trim() || !type) {
      res.flash('error', 'Label e tipo são obrigatórios.');
      return res.redirect('/admin/field-groups/' + req.params.id + '/edit');
    }
    try {
      await FieldService.createField(req.params.id, { label, name, type });
      res.flash('success', 'Campo adicionado.');
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/field-groups/' + req.params.id + '/edit');
  },

  async updateField(req, res) {
    const { label, name, type } = req.body;
    try {
      await FieldService.updateField(req.params.fieldId, { label, name, type });
      res.flash('success', 'Campo atualizado.');
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/field-groups/' + req.params.id + '/edit');
  },

  async deleteField(req, res) {
    await FieldService.deleteField(req.params.fieldId);
    res.flash('success', 'Campo apagado.');
    res.redirect('/admin/field-groups/' + req.params.id + '/edit');
  }
};

module.exports = FieldGroupController;
