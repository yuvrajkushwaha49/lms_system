require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const pwd = process.env.DB_PASSWORD;
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT || '(default 3306)');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('password length:', pwd ? pwd.length : 0);

async function tryConnect(label, extra) {
  try {
    const c = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: pwd,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      connectTimeout: 15000,
      ...extra,
    });
    await c.ping();
    console.log(label + ': OK');
    await c.end();
    return true;
  } catch (e) {
    console.log(label + ':', e.code || e.errno, e.message);
    return false;
  }
}

(async () => {
  if (await tryConnect('plain')) return;
  if (await tryConnect('ssl', { ssl: { rejectUnauthorized: false } })) return;
  const stripped = String(pwd || '').replace(/^['"]|['"]$/g, '');
  if (stripped !== pwd) {
    process.env.DB_PASSWORD = stripped;
    await tryConnect('stripped-password', { ssl: { rejectUnauthorized: false } });
  }
})();
