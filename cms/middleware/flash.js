// Middleware simples de flash messages (sem dependências externas)
function flashMiddleware(req, res, next) {
  // Escrever uma flash message (suportar req.flash E res.flash)
  req.flash = res.flash = function(type, msg) {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({ type, msg });
  };

  // Ler e limpar as flash messages
  res.locals.flash = req.session.flash || [];
  req.session.flash = [];

  next();
}

module.exports = flashMiddleware;
