const PostType = require('../models/PostType');

module.exports = async function sidebarData(req, res, next) {
  try {
    res.locals.customPostTypes = await PostType.findAll();
  } catch {
    res.locals.customPostTypes = [];
  }
  next();
};
