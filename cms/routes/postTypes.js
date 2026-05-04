const express             = require('express');
const router              = express.Router();
const { requireAdmin }    = require('../middleware/auth');
const PostTypeController  = require('../controllers/postTypeController');

router.use(requireAdmin);

router.get('/',                   PostTypeController.list);
router.get('/new',                PostTypeController.newForm);
router.post('/',                  PostTypeController.create);
router.get('/:name/edit',         PostTypeController.editForm);
router.post('/:name',             PostTypeController.update);
router.post('/:name/delete',      PostTypeController.destroy);

module.exports = router;
