const Post       = require('../models/Post');
const Term       = require('../models/Term');
const PostMeta   = require('../models/PostMeta');
const Field      = require('../models/Field');
const FieldGroup = require('../models/FieldGroup');
const makeSlug   = require('../utils/slug');

const PostService = {

  async list(postType, { status, search, page, limit, authorId } = {}) {
    const { rows, total } = await Post.findAll({ postType, status, search, page, limit, authorId });
    const counts = await Post.countByStatus(postType, authorId);
    return { posts: rows, total, counts, page: page || 1, limit: limit || 20 };
  },

  async getWithFullData(id) {
    return Post.findWithFullData(id);
  },

  async getEditorData(postType, postId = null) {
    const groups = await FieldGroup.findByPostType(postType);
    for (const g of groups) {
      g.fields = await Field.findByGroup(g.id);
      if (postId) {
        for (const f of g.fields) {
          f.value = (await PostMeta.getValue(postId, f.id)) ?? '';
        }
      } else {
        for (const f of g.fields) f.value = '';
      }
    }
    return groups;
  },

  async create(authorId, { title, content, excerpt, slug, status, postType, date, termIds = [], meta = {} }) {
    const finalSlug = slug || makeSlug(title);
    const postId = await Post.create({ authorId, title, content, excerpt, slug: finalSlug, status, postType, date });
    await Term.syncPost(postId, termIds.map(Number).filter(Boolean));
    await PostMeta.setMany(postId, meta);
    return postId;
  },

  async update(postId, { title, content, excerpt, slug, status, date, termIds = [], meta = {}, authorId = null }) {
    const finalSlug = slug || makeSlug(title);
    await Post.update(postId, { title, content, excerpt, slug: finalSlug, status, date, authorId });
    await Term.syncPost(postId, termIds.map(Number).filter(Boolean));
    await PostMeta.setMany(postId, meta);
  },

  async delete(postId) {
    await PostMeta.deleteByPost(postId);
    await Term.syncPost(postId, []);
    await Post.delete(postId);
  }
};

module.exports = PostService;
