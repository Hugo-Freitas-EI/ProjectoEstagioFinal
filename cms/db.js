const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL ligado com sucesso');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Erro a ligar ao MySQL:', err.message);
  });

module.exports = pool;
