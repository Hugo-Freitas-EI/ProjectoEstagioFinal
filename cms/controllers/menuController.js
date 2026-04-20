const MenuService = require('../services/menuService');
const db = require('../db');

const MenuController = {
  async list(req, res) {
    const menus = await MenuService.listMenus();
    res.render('admin/menus/index', {
      pageTitle: 'Menus', currentPage: 'menus', menus
    });
  },

  async newForm(req, res) {
    res.render('admin/menus/form', {
      pageTitle: 'Novo Menu', currentPage: 'menus',
      menu: null, error: null
    });
  },

  async create(req, res) {
    const { nome, slug } = req.body;
    if (!nome?.trim()) {
      return res.render('admin/menus/form', {
        pageTitle: 'Novo Menu', currentPage: 'menus',
        menu: req.body, error: 'O nome é obrigatório.'
      });
    }
    try {
      const id = await MenuService.createMenu({ nome, slug });
      res.flash('success', 'Menu criado.');
      res.redirect('/admin/menus/' + id + '/edit');
    } catch (err) {
      res.render('admin/menus/form', {
        pageTitle: 'Novo Menu', currentPage: 'menus',
        menu: req.body, error: err.message
      });
    }
  },

  async editForm(req, res) {
    const data = await MenuService.getMenuWithItems(req.params.id);
    if (!data) return res.redirect('/admin/menus');

    const [pages] = await db.query(
      "SELECT ID as id, post_title as nome, post_name as slug FROM wp_posts WHERE post_type='page' AND post_status='publish' ORDER BY post_title"
    );
    const [posts] = await db.query(
      "SELECT ID as id, post_title as nome, post_name as slug FROM wp_posts WHERE post_type='post' AND post_status='publish' ORDER BY post_title LIMIT 50"
    );
    const [categories] = await db.query('SELECT id, name as nome, slug FROM categories ORDER BY name');
    const allMenus = await MenuService.listMenus();

    res.render('admin/menus/edit', {
      pageTitle: 'Editar Menu — ' + data.nome,
      currentPage: 'menus',
      menu: data,
      items: data.items,
      tree: data.tree,
      pages,
      posts,
      categories,
      allMenus
    });
  },

  async update(req, res) {
    const { nome, slug } = req.body;
    if (!nome?.trim()) {
      res.flash('error', 'O nome é obrigatório.');
      return res.redirect('/admin/menus/' + req.params.id + '/edit');
    }
    try {
      await MenuService.updateMenu(req.params.id, { nome, slug });
      res.flash('success', 'Menu guardado.');
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/menus/' + req.params.id + '/edit');
  },

  async destroy(req, res) {
    try {
      await MenuService.deleteMenu(req.params.id);
      res.flash('success', 'Menu apagado.');
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/menus');
  },

  async addItems(req, res) {
    const menuId = req.params.id;
    const { type } = req.body;
    try {
      if (type === 'custom') {
        const { custom_url, custom_label } = req.body;
        if (custom_label?.trim() && custom_url?.trim()) {
          await MenuService.addItem(menuId, { nome: custom_label.trim(), link: custom_url.trim() });
        }
      } else if (type === 'pages') {
        const ids = [].concat(req.body.page_ids || []);
        for (const id of ids) {
          const [[p]] = await db.query("SELECT post_title, post_name FROM wp_posts WHERE ID=?", [id]);
          if (p) await MenuService.addItem(menuId, { nome: p.post_title, link: '/' + p.post_name });
        }
      } else if (type === 'posts') {
        const ids = [].concat(req.body.post_ids || []);
        for (const id of ids) {
          const [[p]] = await db.query("SELECT post_title, post_name FROM wp_posts WHERE ID=?", [id]);
          if (p) await MenuService.addItem(menuId, { nome: p.post_title, link: '/post/' + p.post_name });
        }
      } else if (type === 'categories') {
        const ids = [].concat(req.body.cat_ids || []);
        for (const id of ids) {
          const [[c]] = await db.query("SELECT name, slug FROM categories WHERE id=?", [id]);
          if (c) await MenuService.addItem(menuId, { nome: c.name, link: '/category/' + c.slug });
        }
      }
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/menus/' + menuId + '/edit');
  },

  async updateItem(req, res) {
    const { nome, link, parent_id } = req.body;
    try {
      await MenuService.updateItem(req.params.itemId, { nome, link, parent_id });
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/menus/' + req.params.id + '/edit');
  },

  async deleteItem(req, res) {
    try {
      await MenuService.deleteItem(req.params.itemId);
    } catch (err) {
      res.flash('error', err.message);
    }
    res.redirect('/admin/menus/' + req.params.id + '/edit');
  },

  async reorder(req, res) {
    try {
      const items = req.body.items;
      if (Array.isArray(items)) {
        await MenuService.reorderItems(items);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async indentItem(req, res) {
    const menuId = req.params.id;
    const itemId = parseInt(req.params.itemId);
    const [[item]] = await db.query(
      'SELECT * FROM menuitens WHERE id = ? AND menu_id = ?', [itemId, menuId]
    );
    if (item) {
      const [siblings] = await db.query(
        'SELECT * FROM menuitens WHERE menu_id = ? AND ' +
        (item.parent_id ? 'parent_id = ?' : 'parent_id IS NULL') +
        ' ORDER BY ordem ASC',
        item.parent_id ? [menuId, item.parent_id] : [menuId]
      );
      const idx = siblings.findIndex(s => s.id === itemId);
      if (idx > 0) {
        const newParent = siblings[idx - 1];
        await db.query('UPDATE menuitens SET parent_id = ? WHERE id = ?', [newParent.id, itemId]);
      }
    }
    res.redirect('/admin/menus/' + menuId + '/edit');
  },

  async outdentItem(req, res) {
    const menuId = req.params.id;
    const itemId = parseInt(req.params.itemId);
    const [[item]] = await db.query(
      'SELECT * FROM menuitens WHERE id = ? AND menu_id = ?', [itemId, menuId]
    );
    if (item && item.parent_id) {
      const [[parent]] = await db.query('SELECT * FROM menuitens WHERE id = ?', [item.parent_id]);
      await db.query(
        'UPDATE menuitens SET parent_id = ? WHERE id = ?',
        [parent?.parent_id ?? null, itemId]
      );
    }
    res.redirect('/admin/menus/' + menuId + '/edit');
  }
};

module.exports = MenuController;
