const Post     = require('../models/Post');
const Term     = require('../models/Term');
const PostMeta = require('../models/PostMeta');
const Field    = require('../models/Field');
const FieldGroup = require('../models/FieldGroup');

function makeSlug(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').trim() || 'sem-titulo';
}

const PostService = {

  // Lista paginada
  async list(postType, { status, search, page, limit, authorId } = {}) {
    const { rows, total } = await Post.findAll({ postType, status, search, page, limit, authorId });
    const counts = await Post.countByStatus(postType, authorId);
    return { posts: rows, total, counts, page: page || 1, limit: limit || 20 };
  },

  // Carrega post completo (termos + campos + meta)
  async getWithFullData(id) {
    return Post.findWithFullData(id);
  },

  // Carrega campos dinâmicos para o editor (sem valores)
  async getEditorData(postType, postId = null) {
    const groups = await FieldGroup.findByPostType(postType);
    for (const g of groups) {
      g.fields = await Field.findByGroup(g.id);
      // Se estiver a editar, preenche os valores actuais
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

  // Cria post + meta + termos numa transacção lógica
  async create(authorId, { title, content, excerpt, slug, status, postType, date, termIds = [], meta = {} }) {
    const finalSlug = slug || makeSlug(title);
    const postId = await Post.create({ authorId, title, content, excerpt, slug: finalSlug, status, postType, date });
    await Term.syncPost(postId, termIds.map(Number).filter(Boolean));
    await PostMeta.setMany(postId, meta);
    return postId;
  },

  // Actualiza post + meta + termos
  async update(postId, { title, content, excerpt, slug, status, date, termIds = [], meta = {} }) {
    const finalSlug = slug || makeSlug(title);
    await Post.update(postId, { title, content, excerpt, slug: finalSlug, status, date });
    await Term.syncPost(postId, termIds.map(Number).filter(Boolean));
    await PostMeta.setMany(postId, meta);
  },

  // Apaga post + todos os dados relacionados
  async delete(postId) {
    await PostMeta.deleteByPost(postId);
    await Term.syncPost(postId, []);
    await Post.delete(postId);
  }
};

module.exports = PostService;
