const express      = require('express');
const router       = express.Router();
const crypto       = require('crypto');
const bcrypt       = require('bcryptjs');
const nodemailer   = require('nodemailer');
const db           = require('../db');

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.MAIL_HOST,
    port:   Number(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      email      VARCHAR(255) NOT NULL,
      token      VARCHAR(64)  NOT NULL UNIQUE,
      expires_at DATETIME     NOT NULL,
      used       TINYINT(1)   DEFAULT 0,
      created_at DATETIME     DEFAULT NOW()
    )
  `);
}

// GET /admin/forgot-password
router.get('/forgot-password', (req, res) => {
  res.render('admin/forgot-password', { error: null, success: null });
});

// POST /admin/forgot-password
router.post('/forgot-password', async (req, res) => {
  await ensureTable();
  const { email } = req.body;
  if (!email) return res.render('admin/forgot-password', { error: 'Introduz o teu email.', success: null });

  const [[user]] = await db.query('SELECT id, email FROM registers WHERE email = ? LIMIT 1', [email]);

  // Resposta genérica para não revelar se o email existe
  const successMsg = 'Se esse email estiver registado receberás um link para redefinir a password.';

  if (!user) return res.render('admin/forgot-password', { error: null, success: successMsg });

  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db.query('DELETE FROM password_resets WHERE email = ?', [email]);
  await db.query('INSERT INTO password_resets (email, token, expires_at) VALUES (?,?,?)', [email, token, expiresAt]);

  const resetUrl = `${process.env.SITE_URL}/admin/reset-password/${token}`;

  try {
    await getTransporter().sendMail({
      from:    process.env.MAIL_FROM,
      to:      email,
      subject: 'Redefinir password — NodeCMS',
      html: `
        <p>Recebemos um pedido para redefinir a password da tua conta NodeCMS.</p>
        <p><a href="${resetUrl}" style="padding:10px 20px;background:#6c63ff;color:#fff;border-radius:6px;text-decoration:none">Redefinir password</a></p>
        <p>Este link é válido durante <strong>1 hora</strong>. Se não fizeste este pedido, ignora este email.</p>
        <p style="color:#888;font-size:12px">${resetUrl}</p>
      `,
    });
  } catch (err) {
    console.error('Erro ao enviar email de reset:', err.message);
    return res.render('admin/forgot-password', { error: 'Erro ao enviar email. Verifica as configurações SMTP.', success: null });
  }

  res.render('admin/forgot-password', { error: null, success: successMsg });
});

// GET /admin/reset-password/:token
router.get('/reset-password/:token', async (req, res) => {
  await ensureTable();
  const [[row]] = await db.query(
    'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1',
    [req.params.token]
  );
  if (!row) return res.render('admin/reset-password', { token: null, error: 'Link inválido ou expirado.', success: null });
  res.render('admin/reset-password', { token: req.params.token, error: null, success: null });
});

// POST /admin/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  await ensureTable();
  const { password, password_confirm } = req.body;
  const { token } = req.params;

  const [[row]] = await db.query(
    'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1',
    [token]
  );
  if (!row) return res.render('admin/reset-password', { token: null, error: 'Link inválido ou expirado.', success: null });

  if (!password || password.length < 6)
    return res.render('admin/reset-password', { token, error: 'A password deve ter pelo menos 6 caracteres.', success: null });
  if (password !== password_confirm)
    return res.render('admin/reset-password', { token, error: 'As passwords não coincidem.', success: null });

  const hashed = await bcrypt.hash(password, 12);
  await db.query('UPDATE registers SET password = ? WHERE email = ?', [hashed, row.email]);
  await db.query('UPDATE password_resets SET used = 1 WHERE token = ?', [token]);

  res.render('admin/reset-password', { token: null, error: null, success: 'Password alterada com sucesso. Podes fazer login.' });
});

module.exports = router;
