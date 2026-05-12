const db       = require('../db');
const Menu     = require('../models/Menu');
const MenuItem = require('../models/MenuItem');
const makeSlug = require('../utils/slug');

function buildTree(items, parentId = null) {
  return items
    .filter(i => (i.parent_id ?? null) == parentId)
    .sort((a, b) => a.ordem - b.ordem)
    .map(i => ({ ...i, children: buildTree(items, i.id) }));
}

const MenuService = {
  async listMenus() {
    return Menu.findAll();
  },

  async getMenuWithItems(id) {
    const menu = await Menu.findById(id);
    if (!menu) return null;
    const items = await MenuItem.findByMenu(id);
    const tree = buildTree(items);
    return { ...menu, items, tree };
  },

  async createMenu({ nome, slug }) {
    const finalSlug = slug?.trim() ? makeSlug(slug) : makeSlug(nome);
    const existing = await Menu.findBySlug(finalSlug);
    if (existing) throw new Error('Já existe um menu com este slug.');
    return Menu.create({ nome: nome.trim(), slug: finalSlug });
  },

  async updateMenu(id, { nome, slug }) {
    const finalSlug = slug?.trim() ? makeSlug(slug) : makeSlug(nome);
    const existing = await Menu.findBySlug(finalSlug);
    if (existing && String(existing.id) !== String(id)) throw new Error('Já existe um menu com este slug.');
    await Menu.update(id, { nome: nome.trim(), slug: finalSlug });
  },

  async deleteMenu(id) {
    await Menu.delete(id);
  },

  async addItem(menuId, { nome, link, parent_id = null }) {
    const [[{ max }]] = await db.query('SELECT MAX(ordem) as max FROM menu_itens WHERE menu_id = ?', [menuId]);
    const ordem = (max ?? -1) + 1;
    return MenuItem.create({ nome, link, parent_id, menu_id: menuId, ordem });
  },

  async updateItem(id, { nome, link, parent_id }) {
    const item = await MenuItem.findById(id);
    if (!item) throw new Error('Item não encontrado.');
    await MenuItem.update(id, {
      nome: nome.trim(),
      link: link.trim(),
      parent_id: parent_id || null,
      ordem: item.ordem
    });
  },

  async deleteItem(id) {
    await db.query('UPDATE menu_itens SET parent_id = NULL WHERE parent_id = ?', [id]);
    await MenuItem.delete(id);
  },

  async reorderItems(items) {
    await MenuItem.reorderWithParents(items);
  }
};

module.exports = MenuService;
