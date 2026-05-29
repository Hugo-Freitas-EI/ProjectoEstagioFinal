// Rota dinâmica que serve QUALQUER post type (incluindo post e page)
// Montada em /admin/cpt/:postType
const express        = require('express');
const router         = express.Router({ mergeParams: true });
const { requireAuth, requirePermission } = require('../middleware/auth');
const PostController = require('../controllers/postController');
const PostType       = require('../models/PostType');

const DENY = (res) => res.status(403).render('frontend/error', {
  pageTitle: 'Sem permissão', message: 'Não tens permissão para aceder a esta secção.', navPages: []
});

// Verifica que o post type existe, injeta em req.basePostType e verifica permissão granular
router.use(requireAuth, async (req, res, next) => {
  const name = req.params.postType;
  const pt   = await PostType.findByName(name);
  if (!pt) return res.status(404).render('frontend/404', { pageTitle: '404', navPages: [] });
  req.basePostType     = pt.name;
  const sysKey         = pt.sysKey || null;
  req.basePostTypePermBase = sysKey === 'post' ? 'posts'
    : sysKey === 'page' ? 'pages'
    : `cpt.${pt.name}`;

  if (req.user.role === 'admin') return next();

  const permBase = req.basePostTypePermBase;
  const level    = req.method === 'GET' ? 'read' : 'write';
  const needed   = `${permBase}.${level}`;
  const perms    = req.user.permissions || [];

  if (perms.includes(needed)) return next();
  if (level === 'read' && perms.includes(`${permBase}.write`)) return next();
  if (level === 'read' && perms.includes(`${permBase}.write_pending`)) return next();
  if (level === 'write' && perms.includes(`${permBase}.write_pending`)) return next();
  return DENY(res);
});

router.get('/',              PostController.list);
router.get('/new',           PostController.newForm);
router.post('/',             PostController.create);
router.get('/:id/edit',      PostController.editForm);
router.post('/:id',          PostController.update);
router.post('/:id/delete',   PostController.destroy);

module.exports = router;
