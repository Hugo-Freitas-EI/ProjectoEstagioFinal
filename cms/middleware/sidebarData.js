const PostType = require('../models/PostType');

module.exports = async function sidebarData(req, res, next) {
  try {
    res.locals.customPostTypes = await PostType.findAll();
    res.locals.systemPostTypes = await Promise.all(
      PostType.SYSTEM.map(s => PostType.findByName(s.name))
    );
  } catch {
    res.locals.customPostTypes = [];
    res.locals.systemPostTypes = PostType.SYSTEM.map(s => ({ ...s, sysKey: s.name }));
  }
  next();
};
