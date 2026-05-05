const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

router.use(requireAuth);

// =============================
// CONFIGURAÇÃO DO MULTER
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|mp4|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Tipo de ficheiro não permitido'));
  }
});


// =============================
// GET - LISTAR MEDIA
// =============================
router.get('/', requirePermission('media.read'), async (req, res) => {
  try {
    const folderId = req.query.folder || null;

    const [media] = await db.query(`
      SELECT 
        m.*,
        r.username
      FROM media m
      LEFT JOIN registers r ON m.autor_id = r.id
      WHERE m.parent_id <=> ?
      ORDER BY m.mime_type IS NULL DESC, m.data_upload DESC
    `, [folderId]);

    res.render('admin/media', {
      files: media,
      currentFolder: folderId
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao carregar media');
  }
});

// =============================
// GET - API LIST (para offcanvas do editor)
// =============================
router.get('/api/list', requirePermission('media.read'), async (req, res) => {
  try {
    const folderId = req.query.folder || null;

    const [items] = await db.query(`
      SELECT m.*, r.username
      FROM media m
      LEFT JOIN registers r ON m.autor_id = r.id
      WHERE m.parent_id <=> ?
      ORDER BY m.mime_type IS NULL DESC, m.data_upload DESC
    `, [folderId]);

    res.json({ files: items });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar media' });
  }
});

// =============================
// POST - UPLOAD
// =============================
router.post('/upload', requirePermission('media.write'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.redirect('/admin/media');

  try {
    const titulo = req.file.originalname;
    const ficheiroUrl = `/uploads/${req.file.filename}`;
    const { folder_id } = req.body;

    // Verificação segura do ID do utilizador
    const autorId = (req.user && req.user.id) ? req.user.id : null;

    // Usamos o NOW() nativo do MySQL em vez do new Date() do JavaScript
    // para garantir que não há erros de formatação na coluna DATETIME
    await db.query(
      `INSERT INTO media 
   (titulo, ficheiro_url, mime_type, data_upload, autor_id, parent_id) 
   VALUES (?, ?, ?, NOW(), ?, ?)`,
      [
        titulo,
        ficheiroUrl,
        req.file.mimetype,
        autorId,
        folder_id || null
      ]
    );

    res.redirect('/admin/media');

  } catch (error) {
    console.error("ERRO NO INSERT:", error);
    // Se o insert falhar na base de dados, apagamos a imagem que fez upload
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.redirect('/admin/media');
  }
});

// =============================
// POST - UPLOAD (API / JSON)
// Usado por pedidos fetch() que precisam de uma resposta JSON { url }
// =============================
router.post('/upload-api', requirePermission('media.write'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });

  const ficheiroUrl = `/uploads/${req.file.filename}`;
  const autorId     = (req.user && req.user.id) ? req.user.id : null;
  const folderId    = req.body.folder_id || null;

  try {
    await db.query(
      `INSERT INTO media (titulo, ficheiro_url, mime_type, data_upload, autor_id, parent_id)
       VALUES (?, ?, ?, NOW(), ?, ?)`,
      [req.file.originalname, ficheiroUrl, req.file.mimetype, autorId, folderId]
    );
    res.json({ url: ficheiroUrl });
  } catch (error) {
    console.error('ERRO NO INSERT (upload-api):', error);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// =============================
// POST - DELETE (CORRIGIDO)
// =============================
router.post('/:id/delete', requirePermission('media.write'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM media WHERE id = ?', [req.params.id]);

    if (rows.length === 0) {
      return res.redirect('/admin/media');
    }

    const media = rows[0];

    // CORREÇÃO: Remover a primeira barra "/" do ficheiro_url para que o path.join 
    // não se confunda e saiba construir o caminho corretamente em qualquer sistema
    const caminhoRelativo = media.ficheiro_url.replace(/^\//, '');
    const filepath = path.join(__dirname, '../public', caminhoRelativo);

    await db.query('DELETE FROM media WHERE id = ?', [req.params.id]);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    res.redirect('/admin/media');

  } catch (error) {
    console.error('Erro ao apagar media:', error);
    res.redirect('/admin/media');
  }
});

// =============================
// POST - UPDATE (NOVO)
// =============================
router.post('/:id/update', requirePermission('media.write'), async (req, res) => {
  try {
    const { titulo, altText, caption, description } = req.body;

    await db.query(
      `UPDATE media SET titulo = ?, altText = ?, caption = ?, description = ? WHERE id = ?`,
      [titulo, altText || null, caption || null, description || null, req.params.id]
    );

    res.redirect('/admin/media');
  } catch (error) {
    console.error('Erro ao atualizar media:', error);
    res.redirect('/admin/media');
  }
});

router.post('/folder', requirePermission('media.write'), async (req, res) => {
  try {
    const { nome, parent_id } = req.body;

    await db.query(
      `INSERT INTO media (titulo, ficheiro_url, mime_type, data_upload, autor_id, parent_id)
       VALUES (?, '', NULL, NOW(), ?, ?)`,
      [
        nome,
        req.user?.id || null,
        parent_id || null
      ]
    );

    res.redirect('/admin/media?folder=' + (parent_id || ''));

  } catch (err) {
    console.error('Erro ao criar pasta:', err);
    res.redirect('/admin/media');
  }
});

module.exports = router;