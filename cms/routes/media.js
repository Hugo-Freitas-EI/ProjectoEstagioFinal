const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|mp4|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Tipo de ficheiro não permitido'));
  }
});

// GET /admin/api/media - lista ficheiros na pasta uploads
router.get('/', (req, res) => {
  const uploadDir = path.join(__dirname, '../public/uploads');
  if (!fs.existsSync(uploadDir)) return res.json([]);

  const files = fs.readdirSync(uploadDir).map(filename => {
    const stat = fs.statSync(path.join(uploadDir, filename));
    return {
      filename,
      url: `/uploads/${filename}`,
      size: stat.size,
      date: stat.mtime
    };
  });

  res.json(files.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// POST /admin/api/media/upload
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro enviado' });

  res.json({
    message: 'Upload com sucesso',
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

// DELETE /admin/api/media/:filename
router.delete('/:filename', (req, res) => {
  const filepath = path.join(__dirname, '../public/uploads', req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Ficheiro não encontrado' });
  fs.unlinkSync(filepath);
  res.json({ message: 'Ficheiro apagado' });
});

module.exports = router;
