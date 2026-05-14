const db = require('../config/db');
const bcrypt = require('bcrypt');

const resolveBusinessIdFromTokenOrUser = async (user) => {
  const tokenBusinessId = user?.business_id || user?.org_id;
  if (tokenBusinessId) return tokenBusinessId;
  if (!user?.id) return null;

  const [rows] = await db.query('SELECT business_id FROM users WHERE id = ? LIMIT 1', [user.id]);
  return rows.length ? rows[0].business_id : null;
};

const resolveOrgIdForDirectory = (user) => user?.org_id || user?.business_id || null;

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

const parseMembersListQuery = (req) => {
  const rawLimit = req.query?.limit;
  const hasPaging =
    rawLimit !== undefined && rawLimit !== null && String(rawLimit).trim() !== '';
  const limit = hasPaging
    ? Math.min(Math.max(parseInt(String(rawLimit), 10), 1), 60)
    : null;
  const offset = hasPaging ? Math.max(parseInt(String(req.query.offset ?? '0'), 10), 0) : 0;
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 120);
  const sortRaw = String(req.query.sort ?? 'latest').toLowerCase();
  const sort = sortRaw === 'name' ? 'name' : 'latest';
  return { hasPaging, limit, offset, q, sort };
};

const getMembers = async (req, res) => {
  try {
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    if (!businessId) {
      return res.status(400).json({ status: 'error', message: 'Business context missing in token.' });
    }

    const { hasPaging, limit, offset, q, sort } = parseMembersListQuery(req);

    const baseWhere = `u.business_id = ?
         AND LOWER(r.name) = 'student'
         AND u.status = 'active'`;
    const baseParams = [businessId];
    let searchSql = '';
    const searchParams = [];
    if (q) {
      searchSql = ' AND (u.name LIKE ? OR u.email LIKE ?)';
      const like = `%${q}%`;
      searchParams.push(like, like);
    }
    const whereClause = `${baseWhere}${searchSql}`;
    const orderBy =
      sort === 'name' ? 'u.name ASC, u.id ASC' : 'u.created_at DESC, u.id DESC';

    if (!hasPaging) {
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
         WHERE ${whereClause}
         ORDER BY ${orderBy}`,
        [...baseParams, ...searchParams],
      );
      return res.json({ status: 'success', data: members });
    }

    const countSql = `SELECT COUNT(*) AS c
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE ${whereClause}`;
    const [[countRow]] = await db.query(countSql, [...baseParams, ...searchParams]);
    const total = Number(countRow?.c) || 0;

    const [rows] = await db.query(
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
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...baseParams, ...searchParams, limit + 1, offset],
    );
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      status: 'success',
      data,
      pagination: {
        has_more: hasMore,
        next_offset: offset + data.length,
        total,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch members.' });
  }
};

/** Any authenticated org member can view basic active profiles in the same business (directory / community). */
const getMemberDirectoryProfile = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    }
    const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
    if (!businessId) {
      return res.status(400).json({ status: 'error', message: 'Business context missing in token.' });
    }
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.business_id = ? AND u.status = 'active'
       LIMIT 1`,
      [id, businessId],
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Member not found.' });
    }
    return res.json({ status: 'success', data: rows[0] });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch member profile.' });
  }
};

const parseMemberListPagination = (req) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '15'), 10), 1), 40);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10), 0);
  return { limit, offset };
};

const loadMemberDirectoryContext = async (req, res) => {
  const memberId = Number(req.params.id);
  if (Number.isNaN(memberId) || memberId <= 0) {
    res.status(400).json({ status: 'error', message: 'Invalid user id.' });
    return null;
  }
  const businessId = await resolveBusinessIdFromTokenOrUser(req.user);
  if (!businessId) {
    res.status(400).json({ status: 'error', message: 'Business context missing in token.' });
    return null;
  }
  const [rows] = await db.query(
    `SELECT u.id FROM users u WHERE u.id = ? AND u.business_id = ? AND u.status = 'active' LIMIT 1`,
    [memberId, businessId],
  );
  if (!rows.length) {
    res.status(404).json({ status: 'error', message: 'Member not found.' });
    return null;
  }
  const orgId = resolveOrgIdForDirectory(req.user) || businessId;
  return { memberId, orgId };
};

const getMemberDirectoryActivitySummary = async (req, res) => {
  try {
    const ctx = await loadMemberDirectoryContext(req, res);
    if (!ctx) return;
    const { memberId, orgId } = ctx;
    const [[postsC]] = await db.query(
      `SELECT COUNT(*) AS c FROM member_feed_posts
       WHERE org_id = ? AND user_id = ? AND processing_status = 'ready' AND COALESCE(is_blocked, 0) = 0`,
      [orgId, memberId],
    );
    const [[commentsC]] = await db.query(
      `SELECT COUNT(*) AS c FROM member_feed_comments WHERE org_id = ? AND user_id = ?`,
      [orgId, memberId],
    );
    const [[spacesC]] = await db.query(
      `SELECT COUNT(DISTINCT posting_space) AS c FROM member_feed_posts
       WHERE org_id = ? AND user_id = ? AND processing_status = 'ready' AND COALESCE(is_blocked, 0) = 0`,
      [orgId, memberId],
    );
    let rewards = 0;
    try {
      const [[wowC]] = await db.query(
        `SELECT COUNT(*) AS c FROM wall_of_wins_entries
         WHERE org_id = ? AND user_id = ? AND COALESCE(is_blocked, 0) = 0`,
        [orgId, memberId],
      );
      rewards = Number(wowC?.c) || 0;
    } catch {
      rewards = 0;
    }
    return res.json({
      status: 'success',
      data: {
        posts: Number(postsC?.c) || 0,
        comments: Number(commentsC?.c) || 0,
        spaces: Number(spacesC?.c) || 0,
        rewards,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load activity summary.' });
  }
};

const getMemberDirectoryFeedPosts = async (req, res) => {
  try {
    const ctx = await loadMemberDirectoryContext(req, res);
    if (!ctx) return;
    const { memberId, orgId } = ctx;
    const { limit, offset } = parseMemberListPagination(req);
    const [rows] = await db.query(
      `SELECT id, heading, sub_heading, posting_space, created_at
       FROM member_feed_posts
       WHERE org_id = ? AND user_id = ? AND processing_status = 'ready' AND COALESCE(is_blocked, 0) = 0
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [orgId, memberId, limit + 1, offset],
    );
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      status: 'success',
      data,
      pagination: { has_more: hasMore, next_offset: offset + data.length },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load posts.' });
  }
};

const getMemberDirectoryFeedComments = async (req, res) => {
  try {
    const ctx = await loadMemberDirectoryContext(req, res);
    if (!ctx) return;
    const { memberId, orgId } = ctx;
    const { limit, offset } = parseMemberListPagination(req);
    const [rows] = await db.query(
      `SELECT c.id, c.post_id, c.comment_text, c.created_at, p.heading AS post_heading
       FROM member_feed_comments c
       INNER JOIN member_feed_posts p ON p.id = c.post_id AND p.org_id = c.org_id
       WHERE c.org_id = ? AND c.user_id = ?
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [orgId, memberId, limit + 1, offset],
    );
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      status: 'success',
      data,
      pagination: { has_more: hasMore, next_offset: offset + data.length },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load comments.' });
  }
};

const getMemberDirectoryPostingSpaces = async (req, res) => {
  try {
    const ctx = await loadMemberDirectoryContext(req, res);
    if (!ctx) return;
    const { memberId, orgId } = ctx;
    const { limit, offset } = parseMemberListPagination(req);
    const [rows] = await db.query(
      `SELECT posting_space AS space, COUNT(*) AS post_count
       FROM member_feed_posts
       WHERE org_id = ? AND user_id = ? AND processing_status = 'ready' AND COALESCE(is_blocked, 0) = 0
       GROUP BY posting_space
       ORDER BY post_count DESC, posting_space ASC
       LIMIT ? OFFSET ?`,
      [orgId, memberId, limit + 1, offset],
    );
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      status: 'success',
      data,
      pagination: { has_more: hasMore, next_offset: offset + data.length },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load spaces.' });
  }
};

const getMemberDirectoryWallOfWins = async (req, res) => {
  try {
    const ctx = await loadMemberDirectoryContext(req, res);
    if (!ctx) return;
    const { memberId, orgId } = ctx;
    const { limit, offset } = parseMemberListPagination(req);
    let rows = [];
    try {
      const [r] = await db.query(
        `SELECT id, title, image_url, created_at
         FROM wall_of_wins_entries
         WHERE org_id = ? AND user_id = ? AND COALESCE(is_blocked, 0) = 0
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [orgId, memberId, limit + 1, offset],
      );
      rows = r;
    } catch {
      rows = [];
    }
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return res.json({
      status: 'success',
      data,
      pagination: { has_more: hasMore, next_offset: offset + data.length },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to load rewards.' });
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

module.exports = {
  createUser,
  getUsers,
  getMembers,
  getMemberDirectoryProfile,
  getMemberDirectoryActivitySummary,
  getMemberDirectoryFeedPosts,
  getMemberDirectoryFeedComments,
  getMemberDirectoryPostingSpaces,
  getMemberDirectoryWallOfWins,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
};
