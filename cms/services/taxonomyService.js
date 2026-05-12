const Category = require('../models/Category');
const Term     = require('../models/Term');
const makeSlug = require('../utils/slug');

const TaxonomyService = {

  async listCategories() {
    const cats = await Category.findAll();
    for (const c of cats) c.postCount = await Category.countPosts(c.id);
    return cats;
  },

  async createCategory({ name, slug, description, userId = null }) {
    const finalSlug = slug || makeSlug(name);
    return Category.create({ name, slug: finalSlug, description, createdBy: userId });
  },

  async updateCategory(id, { name, slug, description, userId = null }) {
    const finalSlug = slug || makeSlug(name);
    await Category.update(id, { name, slug: finalSlug, description, updatedBy: userId });
  },

  async deleteCategory(id) {
    await Category.delete(id);
  },

  async listTerms(categoryId = null) {
    return Term.findAll({ categoryId });
  },

  async createTerm({ name, slug, description, categoryId, userId = null }) {
    const finalSlug = slug || makeSlug(name);
    return Term.create({ name, slug: finalSlug, description, categoryId, createdBy: userId });
  },

  async updateTerm(id, { name, slug, description, categoryId, userId = null }) {
    const finalSlug = slug || makeSlug(name);
    await Term.update(id, { name, slug: finalSlug, description, categoryId, updatedBy: userId });
  },

  async deleteTerm(id) {
    await Term.delete(id);
  }
};

module.exports = TaxonomyService;
