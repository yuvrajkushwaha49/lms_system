const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'business';

const registerPlatform = async (req, res) => {
  const { business_name, org_name, email, contact_email, phone, address, ceo_name, password } = req.body;
  try {
    const businessName = business_name || org_name;
    const businessEmail = email || contact_email || null;
    if (!businessName || !ceo_name || !password || !businessEmail) {
      return res.status(400).json({ status: 'error', message: 'business_name, email, ceo_name and password are required' });
    }

    await db.query(
      `CREATE TABLE IF NOT EXISTS businesses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        call_recording_enabled TINYINT(1) DEFAULT 1,
        store_all_employee_calls TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    await db.query(
      `INSERT INTO roles (name)
       VALUES ('CEO'), ('Admin'), ('Instructor'), ('Student')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    let businessId = null;

    // Primary path: use organizations table because many existing DBs
    // still have users.business_id FK pointing to organizations.id.
    try {
      const [existingOrg] = await db.query('SELECT id FROM organizations WHERE contact_email = ? LIMIT 1', [businessEmail]);
      if (existingOrg.length > 0) {
        return res.status(400).json({ status: 'error', message: 'Business email already in use' });
      }

      const baseSubdomain = slugify(businessName);
      let orgInsertResult = null;
      for (let i = 0; i < 5; i += 1) {
        const candidateSubdomain = i === 0 ? baseSubdomain : `${baseSubdomain}-${Date.now().toString().slice(-4)}-${i}`;
        try {
          const [result] = await db.query(
            'INSERT INTO organizations (name, subdomain, contact_email) VALUES (?, ?, ?)',
            [businessName, candidateSubdomain, businessEmail],
          );
          orgInsertResult = result;
          break;
        } catch (orgInsertError) {
          if (orgInsertError.code !== 'ER_DUP_ENTRY') throw orgInsertError;
        }
      }
      if (!orgInsertResult) {
        return res.status(400).json({ status: 'error', message: 'Unable to generate unique organization subdomain.' });
      }
      businessId = orgInsertResult.insertId;
    } catch (organizationError) {
      if (organizationError.code !== 'ER_NO_SUCH_TABLE') throw organizationError;

      // Fallback path: businesses table (new schema).
      const [existingBusiness] = await db.query('SELECT id FROM businesses WHERE email = ? LIMIT 1', [businessEmail]);
      if (existingBusiness.length > 0) {
        return res.status(400).json({ status: 'error', message: 'Business email already in use' });
      }
      const [businessResult] = await db.query(
        'INSERT INTO businesses (name, email, phone, address) VALUES (?, ?, ?, ?)',
        [businessName, businessEmail, phone || null, address || null],
      );
      businessId = businessResult.insertId;
    }

    const [roleResult] = await db.query('SELECT id FROM roles WHERE name = "CEO" LIMIT 1');
    if (!roleResult.length) {
      return res.status(500).json({ status: 'error', message: 'CEO role is missing in roles table.' });
    }

    await db.query(
      'INSERT INTO users (business_id, role_id, name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
      [businessId, roleResult[0].id, ceo_name, businessEmail || ceo_name, hashedPassword],
    );

    res.status(201).json({ status: 'success', message: 'Platform registered' });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ status: 'error', message: 'Duplicate entry. Email may already be registered.' });
    }
    console.error('registerPlatform error:', error);
    res.status(500).json({ status: 'error', message: 'Failed', error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query(
      `SELECT u.*, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ? AND u.status = 'active'
       LIMIT 1`,
      [email],
    );
    if (users.length === 0 || !await bcrypt.compare(password, users[0].password_hash)) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const payload = {
      id: users[0].id,
      name: users[0].name || null,
      org_id: users[0].business_id,
      business_id: users[0].business_id,
      role_id: users[0].role_id,
      role_name: users[0].role_name,
      email: users[0].email,
    };
    const tokenExpiry = process.env.JWT_EXPIRES_IN || '30d';
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenExpiry });
    res.json({ status: 'success', data: { token, user: payload } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed', error: error.message });
  }
};

module.exports = { registerPlatform, login };
