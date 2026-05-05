const db = require('../db');

const PERMISSION_GROUPS = [
  { key: 'content', label: 'Conteúdo', items: [
    { key: 'posts',  label: 'Posts' },
    { key: 'pages',  label: 'Páginas' },
    { key: 'media',  label: 'Media' },
  ]},
  { key: 'taxonomies', label: 'Taxonomias', items: [
    { key: 'categories', label: 'Categorias' },
    { key: 'terms',      label: 'Termos' },
  ]},
  { key: 'appearance', label: 'Aparência', items: [
    { key: 'menus', label: 'Menus' },
  ]},
  { key: 'structure', label: 'Estrutura', items: [
    { key: 'post-types',   label: 'Tipos de Conteúdo' },
    { key: 'field-groups', label: 'Custom Fields' },
  ]},
  { key: 'management', label: 'Gestão', items: [
    { key: 'users',    label: 'Utilizadores' },
    { key: 'roles',    label: 'Funções' },
    { key: 'settings', label: 'Definições' },
  ]},
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g =>
  g.items.flatMap(i => [`${i.key}.read`, `${i.key}.write`])
);

// Mapeamento de permissões antigas (sem ponto) para o novo formato
const OLD_TO_NEW = {
  'content':    ['posts.write', 'pages.write', 'media.write', 'cpt.write'],
  'taxonomies': ['categories.write', 'terms.write'],
  'appearance': ['menus.write'],
  'structure':  ['post-types.write', 'field-groups.write'],
  'management': ['users.write', 'roles.write', 'settings.write'],
};

const Role = {
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,

  async findAll() {
    const [roles] = await db.query('SELECT * FROM roles ORDER BY is_system DESC, label ASC');
    for (const role of roles) {
      role.permissions = await Role.getPermissions(role.name);
    }
    return roles;
  },

  async findByName(name) {
    const [[role]] = await db.query('SELECT * FROM roles WHERE name = ?', [name]);
    if (!role) return null;
    role.permissions = await Role.getPermissions(role.name);
    return role;
  },

  async getPermissions(roleName) {
    const [rows] = await db.query(
      'SELECT permission FROM role_permissions WHERE role_name = ?', [roleName]
    );
    return rows.map(r => r.permission);
  },

  async create({ name, label, permissions = [], ownContentOnly = false }) {
    await db.query('INSERT INTO roles (name, label, is_system, own_content_only) VALUES (?, ?, 0, ?)', [name, label, ownContentOnly ? 1 : 0]);
    await Role.updatePermissions(name, permissions);
  },

  async updateLabel(name, label) {
    await db.query('UPDATE roles SET label = ? WHERE name = ?', [label, name]);
  },

  async updateOwnContentOnly(name, value) {
    await db.query('UPDATE roles SET own_content_only = ? WHERE name = ?', [value ? 1 : 0, name]);
  },

  async updatePermissions(roleName, permissions = []) {
    await db.query('DELETE FROM role_permissions WHERE role_name = ?', [roleName]);
    if (permissions.length) {
      const vals = permissions.map(p => [roleName, p]);
      await db.query('INSERT INTO role_permissions (role_name, permission) VALUES ?', [vals]);
    }
  },

  async delete(name) {
    await db.query("UPDATE registers SET role = 'subscriber' WHERE role = ?", [name]);
    await db.query('DELETE FROM role_permissions WHERE role_name = ?', [name]);
    await db.query('DELETE FROM roles WHERE name = ? AND is_system = 0', [name]);
  },

  async migrate() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        is_system TINYINT(1) DEFAULT 0,
        own_content_only TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT NOW()
      )
    `);
    // Adicionar coluna se a tabela já existia sem ela (compatível com MySQL/MariaDB antigos)
    const [[colCheck]] = await db.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'own_content_only'
    `);
    if (!colCheck.cnt) {
      await db.query('ALTER TABLE roles ADD COLUMN own_content_only TINYINT(1) DEFAULT 0');
    }
    await db.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_name VARCHAR(50) NOT NULL,
        permission VARCHAR(100) NOT NULL,
        PRIMARY KEY (role_name, permission)
      )
    `);

    await db.query(`INSERT IGNORE INTO roles (name, label, is_system) VALUES
      ('admin',      'Administrador', 1),
      ('editor',     'Editor',        0),
      ('subscriber', 'Subscritor',    1)`);

    // Migrar permissões no formato antigo (sem ponto) para o novo formato granular
    const [oldPerms] = await db.query("SELECT role_name, permission FROM role_permissions WHERE permission NOT LIKE '%.%'");
    for (const { role_name, permission } of oldPerms) {
      const newKeys = OLD_TO_NEW[permission] || [];
      await db.query('DELETE FROM role_permissions WHERE role_name=? AND permission=?', [role_name, permission]);
      if (newKeys.length) {
        const vals = newKeys.map(k => [role_name, k]);
        await db.query('INSERT IGNORE INTO role_permissions (role_name, permission) VALUES ?', [vals]);
      }
    }

    // Seed permissões padrão do editor (se ainda não existirem)
    const editorDefaults = [
      'posts.write', 'pages.write', 'media.write',
      'categories.write', 'terms.write', 'menus.write',
    ];
    const vals = editorDefaults.map(p => ['editor', p]);
    await db.query('INSERT IGNORE INTO role_permissions (role_name, permission) VALUES ?', [vals]);
  },
};

module.exports = Role;
