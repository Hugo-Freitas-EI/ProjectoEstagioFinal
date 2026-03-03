const Category = require('../models/Category');
const Term     = require('../models/Term');

function makeSlug(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

const TaxonomyService = {

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  async listCategories() {
    const cats = await Category.findAll();
    for (const c of cats) c.postCount = await Category.countPosts(c.id);
    return cats;
  },

  async createCategory({ name, slug, description }) {
    const finalSlug = slug || makeSlug(name);
    return Category.create({ name, slug: finalSlug, description });
  },

  async updateCategory(id, { name, slug, description }) {
    const finalSlug = slug || makeSlug(name);
    await Category.update(id, { name, slug: finalSlug, description });
  },

  async deleteCategory(id) {
    await Category.delete(id);
  },

  // ── TERMS ─────────────────────────────────────────────────────────────────

  async listTerms(categoryId = null) {
    return Term.findAll({ categoryId });
  },

  async createTerm({ name, slug, description, categoryId }) {
    const finalSlug = slug || makeSlug(name);
    return Term.create({ name, slug: finalSlug, description, categoryId });
  },

  async updateTerm(id, { name, slug, description, categoryId }) {
    const finalSlug = slug || makeSlug(name);
    await Term.update(id, { name, slug: finalSlug, description, categoryId });
  },

  async deleteTerm(id) {
    await Term.delete(id);
  }
};

module.exports = TaxonomyService;
