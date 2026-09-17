const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManageEvents = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(role);
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const ensureUpcomingEventsTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS upcoming_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      event_date DATE NOT NULL,
      time_label VARCHAR(120) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_upcoming_events_org_active_date (org_id, is_active, event_date, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
};

const formatDateParts = (value) => {
  if (!value) return { day: '', month: '', event_date: '' };

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return { day: '', month: '', event_date: '' };
    return {
      day: String(d).padStart(2, '0'),
      month: MONTHS[m - 1] || '',
      event_date: value.slice(0, 10),
    };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getUTCFullYear();
    const mm = value.getUTCMonth();
    const dd = value.getUTCDate();
    return {
      day: String(dd).padStart(2, '0'),
      month: MONTHS[mm] || '',
      event_date: `${yyyy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
    };
  }

  return { day: '', month: '', event_date: '' };
};

const mapEvent = (row) => {
  const parts = formatDateParts(row.event_date);
  return {
    id: Number(row.id),
    title: row.title || '',
    event_date: parts.event_date,
    day: parts.day,
    month: parts.month,
    time_label: row.time_label || '',
    time: row.time_label || '',
    sort_order: Number(row.sort_order || 0),
    is_active: Number(row.is_active || 0) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const parseEventDate = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return raw;
};

const getUpcomingEvents = async (req, res) => {
  try {
    await ensureUpcomingEventsTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const includeInactive = String(req.query.include_inactive || 'false') === 'true';
    const upcomingOnly = String(req.query.upcoming_only || 'false') === 'true';
    const where = ['org_id = ?'];
    const params = [orgId];

    if (!includeInactive) {
      where.push('is_active = 1');
    }
    if (upcomingOnly) {
      where.push('event_date >= CURDATE()');
    }

    const [rows] = await db.query(
      `SELECT id, title, event_date, time_label, sort_order, is_active, created_at, updated_at
       FROM upcoming_events
       WHERE ${where.join(' AND ')}
       ORDER BY event_date ASC, sort_order ASC, id ASC`,
      params,
    );

    return res.json({ status: 'success', data: rows.map(mapEvent) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to fetch upcoming events.' });
  }
};

const createUpcomingEvent = async (req, res) => {
  try {
    await ensureUpcomingEventsTable();
    if (!canManageEvents(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can manage upcoming events.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const title = String(req.body?.title || '').trim();
    const eventDate = parseEventDate(req.body?.event_date);
    const timeLabel = String(req.body?.time_label || req.body?.time || '').trim().slice(0, 120);
    const sortOrder = Number(req.body?.sort_order || 0);
    const isActive = req.body?.is_active === false || req.body?.is_active === 0 || req.body?.is_active === '0' ? 0 : 1;

    if (!title) {
      return res.status(400).json({ status: 'error', message: 'Title is required.' });
    }
    if (!eventDate) {
      return res.status(400).json({ status: 'error', message: 'Valid event_date (YYYY-MM-DD) is required.' });
    }

    const [result] = await db.query(
      `INSERT INTO upcoming_events (org_id, title, event_date, time_label, sort_order, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orgId, title.slice(0, 255), eventDate, timeLabel, Number.isFinite(sortOrder) ? sortOrder : 0, isActive, req.user?.id || null],
    );

    const [rows] = await db.query(
      `SELECT id, title, event_date, time_label, sort_order, is_active, created_at, updated_at
       FROM upcoming_events WHERE id = ? AND org_id = ? LIMIT 1`,
      [result.insertId, orgId],
    );
    return res.status(201).json({ status: 'success', data: mapEvent(rows[0]) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to create upcoming event.' });
  }
};

const updateUpcomingEvent = async (req, res) => {
  try {
    await ensureUpcomingEventsTable();
    if (!canManageEvents(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can manage upcoming events.' });
    }
    const orgId = resolveOrgId(req.user);
    const eventId = Number(req.params.eventId);
    if (!orgId || Number.isNaN(eventId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid event id.' });
    }

    const [existingRows] = await db.query(
      'SELECT id, title, event_date, time_label, sort_order, is_active FROM upcoming_events WHERE id = ? AND org_id = ? LIMIT 1',
      [eventId, orgId],
    );
    if (!existingRows.length) {
      return res.status(404).json({ status: 'error', message: 'Event not found.' });
    }
    const existing = existingRows[0];

    const title =
      req.body?.title != null ? String(req.body.title).trim().slice(0, 255) : existing.title;
    const eventDate =
      req.body?.event_date != null ? parseEventDate(req.body.event_date) : formatDateParts(existing.event_date).event_date;
    const timeLabel =
      req.body?.time_label != null || req.body?.time != null
        ? String(req.body.time_label ?? req.body.time ?? '').trim().slice(0, 120)
        : existing.time_label;
    const sortOrder =
      req.body?.sort_order != null ? Number(req.body.sort_order) : Number(existing.sort_order || 0);
    let isActive = Number(existing.is_active || 0);
    if (req.body?.is_active !== undefined) {
      isActive = req.body.is_active === false || req.body.is_active === 0 || req.body.is_active === '0' ? 0 : 1;
    }

    if (!title) {
      return res.status(400).json({ status: 'error', message: 'Title is required.' });
    }
    if (!eventDate) {
      return res.status(400).json({ status: 'error', message: 'Valid event_date (YYYY-MM-DD) is required.' });
    }

    await db.query(
      `UPDATE upcoming_events
       SET title = ?, event_date = ?, time_label = ?, sort_order = ?, is_active = ?
       WHERE id = ? AND org_id = ?`,
      [title, eventDate, timeLabel, Number.isFinite(sortOrder) ? sortOrder : 0, isActive, eventId, orgId],
    );

    const [rows] = await db.query(
      `SELECT id, title, event_date, time_label, sort_order, is_active, created_at, updated_at
       FROM upcoming_events WHERE id = ? AND org_id = ? LIMIT 1`,
      [eventId, orgId],
    );
    return res.json({ status: 'success', data: mapEvent(rows[0]) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to update upcoming event.' });
  }
};

const deleteUpcomingEvent = async (req, res) => {
  try {
    await ensureUpcomingEventsTable();
    if (!canManageEvents(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can manage upcoming events.' });
    }
    const orgId = resolveOrgId(req.user);
    const eventId = Number(req.params.eventId);
    if (!orgId || Number.isNaN(eventId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid event id.' });
    }

    const [result] = await db.query('DELETE FROM upcoming_events WHERE id = ? AND org_id = ?', [eventId, orgId]);
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'Event not found.' });
    }
    return res.json({ status: 'success', message: 'Event deleted.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to delete upcoming event.' });
  }
};

module.exports = {
  getUpcomingEvents,
  createUpcomingEvent,
  updateUpcomingEvent,
  deleteUpcomingEvent,
};
