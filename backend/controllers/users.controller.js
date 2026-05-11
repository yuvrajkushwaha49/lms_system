const db = require('../config/db');
const bcrypt = require('bcrypt');

const resolveBusinessIdFromTokenOrUser = async (user) => {
  const tokenBusinessId = user?.business_id || user?.org_id;
  if (tokenBusinessId) return tokenBusinessId;
  if (!user?.id) return null;

  const [rows] = await db.query('SELECT business_id FROM users WHERE id = ? LIMIT 1', [user.id]);
  return rows.length ? rows[0].business_id : null;
};

const normalizeRequestedRole = (roleName) => {
  const normalizedInput = String(roleName || 'Admin').trim().toLowerCase();
  const roleMap = {
    admin: 'Admin',
    instructor: 'Instructor',
    trainer: 'Instructor',
    ceo: 'CEO',
    student: 'Student',
  };
  return roleMap[normalizedInput] || null;
};

const findRoleId = async (roleName) => {
  // Primary schema: roles.name
  try {
    const [roles] = await db.query(
      'SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [roleName],
    );
    if (roles.length) return roles[0].id;
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
  }

  // Legacy schema support: roles.role_name
  try {
    const [roles] = await db.query(
      'SELECT id FROM roles WHERE LOWER(role_name) = LOWER(?) LIMIT 1',
      [roleName],
    );
    if (roles.length) return roles[0].id;
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
  }

  // Legacy value support in some setups where Trainer exists instead of Instructor
  if (roleName === 'Instructor') {
    try {
      const [roles] = await db.query(
        'SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1',
        ['Trainer'],
      );
      if (roles.length) return roles[0].id;
    } catch (error) {
      if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    }
  }

  return null;
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role_name } = req.body;
    const normalizedRole = normalizeRequestedRole(role_name);
    const acceptedRoles = ['Admin', 'Instructor'];
    if (!normalizedRole || !acceptedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        status: 'error',
        message: 'Only Admin or Instructor role can be created from this flow.',
      });
    }
    const roleId = await findRoleId(normalizedRole);
    if (!roleId) return res.status(400).json({ status: 'error', message: 'Role not found.' });
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    if (!businessId) {
      return res.status(400).json({ status: 'error', message: 'Business context missing in token.' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (business_id, role_id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [businessId, roleId, name, email, phone || null, hash],
    );
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message || 'Failed to create user.' });
  }
};

const getUsers = async (req, res) => {
  try {
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    const baseQuery = `SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.status,
        u.created_at,
        r.name AS role
      FROM users u
      JOIN roles r ON u.role_id = r.id`;
    const [users] = businessId
      ? await db.query(`${baseQuery} WHERE u.business_id = ? ORDER BY u.created_at DESC`, [businessId])
      : await db.query(`${baseQuery} ORDER BY u.created_at DESC`);
    res.json({ status: 'success', data: users });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch users.' });
  }
};

const getMembers = async (req, res) => {
  try {
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    if (!businessId) {
      return res.status(400).json({ status: 'error', message: 'Business context missing in token.' });
    }

    const [members] = await db.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.phone,
         u.status,
         u.created_at,
         r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.business_id = ?
         AND LOWER(r.name) = 'student'
         AND u.status = 'active'
       ORDER BY u.created_at DESC`,
      [businessId],
    );

    return res.json({ status: 'success', data: members });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch members.' });
  }
};

const getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    }
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    const [rows] = businessId
      ? await db.query(
          `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, r.name AS role
           FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE u.id = ? AND u.business_id = ?`,
          [id, businessId],
        )
      : await db.query(
          `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, r.name AS role
           FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE u.id = ?`,
          [id],
        );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    res.json({ status: 'success', data: rows[0] });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch user.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    }
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ status: 'error', message: 'name and email are required.' });
    }
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    const [result] = businessId
      ? await db.query(
          'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ? AND business_id = ?',
          [name, email, phone || null, id, businessId],
        )
      : await db.query('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', [
          name,
          email,
          phone || null,
          id,
        ]);
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    return res.json({ status: 'success' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to update user.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    }
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    const [result] = businessId
      ? await db.query('DELETE FROM users WHERE id = ? AND business_id = ?', [id, businessId])
      : await db.query('DELETE FROM users WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    return res.json({ status: 'success' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete user.' });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    }
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    const [rows] = businessId
      ? await db.query('SELECT status FROM users WHERE id = ? AND business_id = ? LIMIT 1', [id, businessId])
      : await db.query('SELECT status FROM users WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    const nextStatus = rows[0].status === 'active' ? 'inactive' : 'active';
    if (businessId) {
      await db.query('UPDATE users SET status = ? WHERE id = ? AND business_id = ?', [nextStatus, id, businessId]);
    } else {
      await db.query('UPDATE users SET status = ? WHERE id = ?', [nextStatus, id]);
    }
    return res.json({ status: 'success', data: { status: nextStatus } });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to toggle status.' });
  }
};

module.exports = { createUser, getUsers, getMembers, getUserById, updateUser, deleteUser, toggleUserStatus };
