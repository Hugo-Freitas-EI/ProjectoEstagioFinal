const MenuService   = require('../services/menuService');
const PostType      = require('../models/PostType');
const SiteSetting   = require('../models/SiteSetting');
const db = require('../db');

// ── helpers ─────────────────────────────────────────────────────────────────

function makeKey(label) {
  return (label || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

async function getLocations() {
  const custom = JSON.parse(await SiteSetting.get('menu_locations_custom') || '[]');
  return [{ key: 'header', label: 'Header', system: true }, ...custom];
}

async function getLocationAssignments(locations) {
  const out = {};
  for (const loc of locations) {
    out[loc.key] = await SiteSetting.get('menu_location_' + loc.key);
  }
  return out;
}

// ── controller ───────────────────────────────────────────────────────────────

const MenuController = {
  async list(req, res) {
    const [menus, locations] = await Promise.all([
      MenuService.listMenus(),
      getLocations()
    ]);
    const assignments = await getLocationAssignments(locations);
    const menuMap = Object.fromEntries(menus.map(m => [String(m.id), m]));
    const locationsWithMenu = locations.map(loc => ({
      ...loc,
      assignedMenu: menuMap[String(assignments[loc.key])] || null
    }));
    res.render('admin/menus/index', {
      pageTitle: 'Menus', currentPage: 'menus', menus, locationsWithMenu
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

    const [postPt, pagePt] = await Promise.all([
      PostType.findByName('post'),
      PostType.findByName('page')
    ]);

    const [pages] = await db.query(
      'SELECT ID as id, post_title as nome, post_name as slug FROM wp_posts WHERE post_type=? AND post_status=\'publish\' ORDER BY post_title',
      [pagePt.name]
    );
    const [posts] = await db.query(
      'SELECT ID as id, post_title as nome, post_name as slug FROM wp_posts WHERE post_type=? AND post_status=\'publish\' ORDER BY post_title LIMIT 50',
      [postPt.name]
    );
    const [categories] = await db.query('SELECT id, name as nome, slug FROM categories ORDER BY name');
    const allMenus = await MenuService.listMenus();

    const customPostTypes = await PostType.findAll();
    const cptData = await Promise.all(customPostTypes.map(async cpt => {
      const [cptPosts] = await db.query(
        "SELECT ID as id, post_title as nome, post_name as slug FROM wp_posts WHERE post_type=? AND post_status='publish' ORDER BY post_title LIMIT 50",
        [cpt.name]
      );
      return { name: cpt.name, label: cpt.label, posts: cptPosts };
    }));

    const locations    = await getLocations();
    const assignments  = await getLocationAssignments(locations);
    const menuMap      = Object.fromEntries(allMenus.map(m => [String(m.id), m]));
    const locationsWithMenu = locations.map(loc => ({
      ...loc,
      assignedMenuId:   assignments[loc.key] || null,
      assignedMenu:     menuMap[String(assignments[loc.key])] || null,
      isThisMenu:       String(assignments[loc.key]) === String(req.params.id)
    }));

    res.render('admin/menus/edit', {
      pageTitle: 'Editar Menu — ' + data.nome,
      currentPage: 'menus',
      menu: data,
      items: data.items,
      tree: data.tree,
      pages,
      posts,
      categories,
      allMenus,
      cptData,
      locationsWithMenu,
      postPt,
      pagePt
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
        const pagePt = await PostType.findByName('page');
        const ids = [].concat(req.body.page_ids || []);
        for (const id of ids) {
          const [[p]] = await db.query("SELECT post_title, post_name FROM wp_posts WHERE ID=?", [id]);
          if (p) await MenuService.addItem(menuId, { nome: p.post_title, link: '/' + pagePt.prefix + '/' + p.post_name });
        }
      } else if (type === 'posts') {
        const postPt = await PostType.findByName('post');
        const ids = [].concat(req.body.post_ids || []);
        for (const id of ids) {
          const [[p]] = await db.query("SELECT post_title, post_name FROM wp_posts WHERE ID=?", [id]);
          if (p) await MenuService.addItem(menuId, { nome: p.post_title, link: '/' + postPt.prefix + '/' + p.post_name });
        }
      } else if (type === 'cpt') {
        const { cpt_name, cpt_ids } = req.body;
        const ids = [].concat(cpt_ids || []);
        for (const id of ids) {
          const [[p]] = await db.query("SELECT post_title, post_name FROM wp_posts WHERE ID=?", [id]);
          if (p) await MenuService.addItem(menuId, { nome: p.post_title, link: '/' + cpt_name + '/' + p.post_name });
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
      if (Array.isArray(items)) await MenuService.reorderItems(items);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async indentItem(req, res) {
    const menuId = req.params.id;
    const itemId = parseInt(req.params.itemId);
    const [[item]] = await db.query(
      'SELECT * FROM menu_itens WHERE id = ? AND menu_id = ?', [itemId, menuId]
    );
    if (item) {
      const [siblings] = await db.query(
        'SELECT * FROM menu_itens WHERE menu_id = ? AND ' +
        (item.parent_id ? 'parent_id = ?' : 'parent_id IS NULL') +
        ' ORDER BY ordem ASC',
        item.parent_id ? [menuId, item.parent_id] : [menuId]
      );
      const idx = siblings.findIndex(s => s.id === itemId);
      if (idx > 0) {
        const newParent = siblings[idx - 1];
        await db.query('UPDATE menu_itens SET parent_id = ? WHERE id = ?', [newParent.id, itemId]);
      }
    }
    res.redirect('/admin/menus/' + menuId + '/edit');
  },

  async saveLocations(req, res) {
    const menuId   = req.params.id;
    const locations = await getLocations();
    for (const loc of locations) {
      const checked = req.body['location_' + loc.key] === '1';
      if (checked) {
        await SiteSetting.set('menu_location_' + loc.key, menuId);
      } else {
        const current = await SiteSetting.get('menu_location_' + loc.key);
        if (String(current) === String(menuId)) {
          await SiteSetting.set('menu_location_' + loc.key, null);
        }
      }
    }
    res.flash('success', 'Localizações guardadas.');
    res.redirect('/admin/menus/' + menuId + '/edit');
  },

  async createLocation(req, res) {
    const { label } = req.body;
    if (!label?.trim()) {
      res.flash('error', 'O nome da localização é obrigatório.');
      return res.redirect('/admin/menus');
    }
    const key = makeKey(label);
    if (!key) {
      res.flash('error', 'Nome inválido.');
      return res.redirect('/admin/menus');
    }
    const existing = JSON.parse(await SiteSetting.get('menu_locations_custom') || '[]');
    const allKeys  = ['header', ...existing.map(l => l.key)];
    if (allKeys.includes(key)) {
      res.flash('error', 'Já existe uma localização com esse nome.');
      return res.redirect('/admin/menus');
    }
    existing.push({ key, label: label.trim() });
    await SiteSetting.set('menu_locations_custom', JSON.stringify(existing));
    res.flash('success', 'Localização "' + label.trim() + '" criada.');
    res.redirect('/admin/menus');
  },

  async deleteLocation(req, res) {
    const key = req.params.key;
    if (key === 'header') {
      res.flash('error', 'A localização Header é de sistema e não pode ser removida.');
      return res.redirect('/admin/menus');
    }
    const existing = JSON.parse(await SiteSetting.get('menu_locations_custom') || '[]');
    const updated  = existing.filter(l => l.key !== key);
    await SiteSetting.set('menu_locations_custom', JSON.stringify(updated));
    await SiteSetting.set('menu_location_' + key, null);
    res.flash('success', 'Localização removida.');
    res.redirect('/admin/menus');
  },

  async outdentItem(req, res) {
    const menuId = req.params.id;
    const itemId = parseInt(req.params.itemId);
    const [[item]] = await db.query(
      'SELECT * FROM menu_itens WHERE id = ? AND menu_id = ?', [itemId, menuId]
    );
    if (item && item.parent_id) {
      const [[parent]] = await db.query('SELECT * FROM menu_itens WHERE id = ?', [item.parent_id]);
      await db.query(
        'UPDATE menu_itens SET parent_id = ? WHERE id = ?',
        [parent?.parent_id ?? null, itemId]
      );
    }
    res.redirect('/admin/menus/' + menuId + '/edit');
  }
};

module.exports = MenuController;
