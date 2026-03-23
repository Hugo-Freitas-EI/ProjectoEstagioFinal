// Rota dinâmica que serve QUALQUER post type (incluindo post e page)
// Montada em /admin/cpt/:postType
const express        = require('express');
const router         = express.Router({ mergeParams: true });
const { requireAuth }= require('../middleware/auth');
const PostController = require('../controllers/postController');
const PostType       = require('../models/PostType');

// Verifica que o post type existe e injeta em req.basePostType
router.use(requireAuth, async (req, res, next) => {
  const name = req.params.postType;
  const pt   = await PostType.findByName(name);
  if (!pt) return res.status(404).render('frontend/404', { pageTitle: '404', navPages: [] });
  req.basePostType = name;
  next();
});

router.get('/',              PostController.list);
router.get('/new',           PostController.newForm);
router.post('/',             PostController.create);
router.get('/:id/edit',      PostController.editForm);
router.post('/:id',          PostController.update);
router.post('/:id/delete',   PostController.destroy);

module.exports = router;
