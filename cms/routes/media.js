const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

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
router.get('/', async (req, res) => {
  try {
    const [media] = await db.query(
      'SELECT * FROM media ORDER BY data_upload DESC'
    );

    res.render('admin/media', {
      files: media
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao carregar media');
  }
});


// =============================
// POST - UPLOAD
// =============================
router.post('/upload', upload.single('file'), async (req, res) => {
  console.log("UPLOAD ATINGIDO");
  console.log("FILE:", req.file);
  console.log("BODY:", req.body);
  console.log("USER:", req.user);
  
  if (!req.file) return res.redirect('/admin/media');

  try {
    const now = new Date();
    const titulo = req.file.originalname;
    const ficheiroUrl = `/uploads/${req.file.filename}`;

    await db.query(
      `INSERT INTO media 
       (titulo, ficheiro_url, mime_type, data_upload, autor_id, parent_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        titulo,
        ficheiroUrl,
        req.file.mimetype,
        now,
        req.user?.id || null,
        null
      ]
    );

    console.log("INSERT OK");
    res.redirect('/admin/media');

  } catch (error) {
    console.error("ERRO NO INSERT:", error);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.redirect('/admin/media');
  }
});

// =============================
// POST - DELETE (CORRIGIDO)
// =============================
router.post('/:id/delete', async (req, res) => {

  try {

    const [rows] = await db.query(
      'SELECT * FROM media WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.redirect('/admin/media');
    }

    const media = rows[0];

    const filepath = path.join(
      __dirname,
      '../public',
      media.ficheiro_url.replace('/uploads/', 'uploads/')
    );

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

module.exports = router;