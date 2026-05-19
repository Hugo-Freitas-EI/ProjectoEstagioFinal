const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

router.use(requireAuth);

// =============================
// CONFIGURAÇÃO DO CLOUDINARY
// =============================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'nodecms',
    resource_type: file.mimetype.startsWith('video/') ? 'video' : 'auto',
    use_filename: false
  })
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|mp4|svg/;
    const ext = allowed.test(file.originalname.split('.').pop().toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Tipo de ficheiro não permitido'));
  }
});

// Extrai o public_id e resource_type de um URL do Cloudinary ou de um ficheiro local
function cloudinaryPublicId(url, mimetype) {
  if (!url || !url.includes('cloudinary.com')) return null;
  // URL: https://res.cloudinary.com/<cloud>/image/upload/v123/nodecms/abc123.jpg
  const uploadPart = url.split('/upload/')[1];
  if (!uploadPart) return null;
  const withoutVersion = uploadPart.replace(/^v\d+\//, '');
  return withoutVersion.replace(/\.[^/.]+$/, '');
}

function cloudinaryResourceType(mimetype) {
  if (!mimetype) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'raw';
  return 'image';
}

// =============================
// GET - LISTAR MEDIA
// =============================
router.get('/', requirePermission('media.read'), async (req, res) => {
  try {
    const folderId = req.query.folder || null;
    const [media] = await db.query(`
      SELECT m.*, r.username
      FROM media m
      LEFT JOIN registers r ON m.autor_id = r.id
      WHERE m.parent_id <=> ?
      ORDER BY m.mime_type IS NULL DESC, m.data_upload DESC
    `, [folderId]);
    res.render('admin/media', { files: media, currentFolder: folderId });
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
router.post('/upload', requirePermission('media.write'), (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('ERRO NO UPLOAD (Cloudinary):', err);
      req.flash('error', 'Erro no upload: ' + err.message);
      return res.redirect('/admin/media');
    }
    if (!req.file) return res.redirect('/admin/media');
    try {
      const ficheiroUrl = req.file.path;
      const autorId     = req.user?.id || null;
      const folderId    = req.body.folder_id || null;
      await db.query(
        `INSERT INTO media (titulo, ficheiro_url, mime_type, data_upload, autor_id, parent_id)
         VALUES (?, ?, ?, NOW(), ?, ?)`,
        [req.file.originalname, ficheiroUrl, req.file.mimetype, autorId, folderId]
      );
      res.redirect('/admin/media');
    } catch (error) {
      console.error('ERRO NO INSERT:', error);
      req.flash('error', 'Erro ao guardar ficheiro na base de dados.');
      res.redirect('/admin/media');
    }
  });
});

// =============================
// POST - UPLOAD (API / JSON)
// =============================
router.post('/upload-api', requirePermission('media.write'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('ERRO NO UPLOAD-API (Cloudinary):', err);
      return res.status(500).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });
    try {
      const ficheiroUrl = req.file.path;
      const autorId     = req.user?.id || null;
      const folderId    = req.body.folder_id || null;
      await db.query(
        `INSERT INTO media (titulo, ficheiro_url, mime_type, data_upload, autor_id, parent_id)
         VALUES (?, ?, ?, NOW(), ?, ?)`,
        [req.file.originalname, ficheiroUrl, req.file.mimetype, autorId, folderId]
      );
      res.json({ url: ficheiroUrl });
    } catch (error) {
      console.error('ERRO NO INSERT (upload-api):', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// =============================
// POST - DELETE
// =============================
router.post('/:id/delete', requirePermission('media.write'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM media WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/media');

    const media = rows[0];
    await db.query('DELETE FROM media WHERE id = ?', [req.params.id]);

    const publicId = cloudinaryPublicId(media.ficheiro_url, media.mime_type);
    if (publicId) {
      const resourceType = cloudinaryResourceType(media.mime_type);
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});
    }

    res.redirect('/admin/media');
  } catch (error) {
    console.error('Erro ao apagar media:', error);
    res.redirect('/admin/media');
  }
});

// =============================
// POST - UPDATE
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

// =============================
// POST - CRIAR PASTA
// =============================
router.post('/folder', requirePermission('media.write'), async (req, res) => {
  try {
    const { nome, parent_id } = req.body;
    await db.query(
      `INSERT INTO media (titulo, ficheiro_url, mime_type, data_upload, autor_id, parent_id)
       VALUES (?, '', NULL, NOW(), ?, ?)`,
      [nome, req.user?.id || null, parent_id || null]
    );
    res.redirect('/admin/media?folder=' + (parent_id || ''));
  } catch (err) {
    console.error('Erro ao criar pasta:', err);
    res.redirect('/admin/media');
  }
});

module.exports = router;
