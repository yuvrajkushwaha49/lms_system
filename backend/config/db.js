const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function envPassword() {
  return String(process.env.DB_PASSWORD || '').replace(/^['"]|['"]$/g, '');
}

function buildPoolConfig() {
  const host = process.env.DB_HOST || 'localhost';
  const useSsl =
    process.env.DB_SSL === '1' ||
    process.env.DB_SSL === 'true' ||
    /\.hstgr\.io$/i.test(host);

  const config = {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: envPassword(),
    database: process.env.DB_NAME || 'workians_lms',
    waitForConnections: true,
    // Microservices: keep low — remote hosts (e.g. Hostinger) limit total connections
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 3),
    queueLimit: 0,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 20000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };

  if (useSsl) {
    config.ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === '1',
    };
  }

  return config;
}

/** User-facing message for API responses */
function mapDbError(error) {
  const code = String(error?.code || '');
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'PROTOCOL_CONNECTION_LOST', 'ECONNRESET'].includes(code)) {
    return 'Database is unreachable. Check DB_HOST/DB_PORT/network and try again.';
  }
  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return 'Database access denied. Check DB_USER and DB_PASSWORD in backend/.env.';
  }
  if (code === 'ER_CON_COUNT_ERROR' || code === 'Too many connections') {
    return 'Database connection limit reached. Lower DB_CONNECTION_LIMIT or use fewer service instances.';
  }
  return error?.message || 'Database error';
}

function isDbConnectionError(error) {
  const code = String(error?.code || '');
  return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ER_ACCESS_DENIED_ERROR', 'ER_CON_COUNT_ERROR'].includes(code);
}

const pool = mysql.createPool(buildPoolConfig());

pool
  .getConnection()
  .then((connection) => {
    console.log(`Successfully connected to the database (${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}).`);
    connection.release();
  })
  .catch((error) => {
    console.error('Error connecting to the database:', mapDbError(error));
    if (error?.code) console.error('  code:', error.code);
  });

module.exports = pool;
module.exports.mapDbError = mapDbError;
module.exports.isDbConnectionError = isDbConnectionError;
