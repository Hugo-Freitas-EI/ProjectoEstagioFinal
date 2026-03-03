const FieldGroup = require('../models/FieldGroup');
const Field      = require('../models/Field');

const FieldService = {

  // ── FIELD GROUPS ──────────────────────────────────────────────────────────

  async listGroups() {
    const groups = await FieldGroup.findAll();
    for (const g of groups) {
      g.fields = await Field.findByGroup(g.id);
    }
    return groups;
  },

  async getGroup(id) {
    const group = await FieldGroup.findById(id);
    if (!group) return null;
    group.fields = await Field.findByGroup(id);
    return group;
  },

  async createGroup({ name, postType }) {
    return FieldGroup.create({ name, postType });
  },

  async updateGroup(id, { name, postType }) {
    await FieldGroup.update(id, { name, postType });
  },

  async deleteGroup(id) {
    await FieldGroup.delete(id);
  },

  // ── FIELDS ────────────────────────────────────────────────────────────────

  async createField(groupId, { label, name, type, options, required }) {
    // Normaliza name (sem espaços)
    const fieldName = (name || label).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return Field.create({ groupId, label, name: fieldName, type, options, required: required ? 1 : 0 });
  },

  async updateField(id, { label, name, type, options, required }) {
    const fieldName = (name || label).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await Field.update(id, { label, name: fieldName, type, options, required: required ? 1 : 0 });
  },

  async deleteField(id) {
    await Field.delete(id);
  },

  getFieldTypes() {
    return Field.TYPES;
  }
};

module.exports = FieldService;
