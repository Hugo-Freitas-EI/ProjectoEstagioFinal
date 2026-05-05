const express             = require('express');
const router              = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const PostTypeController  = require('../controllers/postTypeController');

router.use(requireAuth);

router.get('/',              requirePermission('post-types.read'),  PostTypeController.list);
router.get('/new',           requirePermission('post-types.write'), PostTypeController.newForm);
router.post('/',             requirePermission('post-types.write'), PostTypeController.create);
router.get('/:name/edit',    requirePermission('post-types.write'), PostTypeController.editForm);
router.post('/:name',        requirePermission('post-types.write'), PostTypeController.update);
router.post('/:name/delete', requirePermission('post-types.write'), PostTypeController.destroy);

module.exports = router;
