const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const canManageFaqs = (user) => {
  const role = String(user?.role_name || '').toLowerCase();
  return ['ceo', 'admin', 'instructor', 'trainer'].includes(role);
};

const ensureFaqTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS faqs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      question VARCHAR(500) NOT NULL,
      answer TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_faq_org_active_order (org_id, is_active, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    'ALTER TABLE faqs ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0',
  );
  await db.query(
    'ALTER TABLE faqs ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1',
  );
};

const mapFaq = (row) => ({
  id: Number(row.id),
  question: row.question || '',
  answer: row.answer || '',
  sort_order: Number(row.sort_order || 0),
  is_active: Number(row.is_active || 0) === 1,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getFaqs = async (req, res) => {
  try {
    await ensureFaqTable();
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const includeInactive = String(req.query.include_inactive || 'false') === 'true';
    const whereActive = includeInactive ? '' : ' AND is_active = 1';
    const [rows] = await db.query(
      `SELECT id, question, answer, sort_order, is_active, created_at, updated_at
       FROM faqs
       WHERE org_id = ?${whereActive}
       ORDER BY sort_order ASC, id ASC`,
      [orgId],
    );

    return res.json({ status: 'success', data: rows.map(mapFaq) });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to fetch FAQs.' });
  }
};

const createFaq = async (req, res) => {
  try {
    await ensureFaqTable();
    if (!canManageFaqs(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can upload FAQs.' });
    }
    const orgId = resolveOrgId(req.user);
    if (!orgId) {
      return res.status(400).json({ status: 'error', message: 'Organization context missing in token.' });
    }

    const question = String(req.body?.question || '').trim();
    const answer = String(req.body?.answer || '').trim();
    const sortOrder = Number(req.body?.sort_order || 0);
    const isActive = req.body?.is_active === false || req.body?.is_active === 'false' ? 0 : 1;

    if (!question || !answer) {
      return res.status(400).json({ status: 'error', message: 'Question and answer are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO faqs (org_id, question, answer, sort_order, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, question.slice(0, 500), answer, Number.isNaN(sortOrder) ? 0 : sortOrder, isActive, req.user?.id || null],
    );

    const [rows] = await db.query(
      'SELECT id, question, answer, sort_order, is_active, created_at, updated_at FROM faqs WHERE id = ? AND org_id = ? LIMIT 1',
      [result.insertId, orgId],
    );

    return res.status(201).json({ status: 'success', data: rows[0] ? mapFaq(rows[0]) : null });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to upload FAQ.' });
  }
};

const updateFaq = async (req, res) => {
  try {
    await ensureFaqTable();
    if (!canManageFaqs(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can manage FAQs.' });
    }
    const orgId = resolveOrgId(req.user);
    const faqId = Number(req.params.faqId);
    if (!orgId || Number.isNaN(faqId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid FAQ request.' });
    }

    const [existingRows] = await db.query(
      'SELECT id FROM faqs WHERE id = ? AND org_id = ? LIMIT 1',
      [faqId, orgId],
    );
    if (!existingRows.length) {
      return res.status(404).json({ status: 'error', message: 'FAQ not found.' });
    }

    const question = req.body?.question != null ? String(req.body.question).trim().slice(0, 500) : null;
    const answer = req.body?.answer != null ? String(req.body.answer).trim() : null;
    const sortOrder = req.body?.sort_order != null ? Number(req.body.sort_order) : null;
    const isActive = req.body?.is_active != null
      ? (req.body.is_active === true || req.body.is_active === 'true' || req.body.is_active === 1 || req.body.is_active === '1' ? 1 : 0)
      : null;

    await db.query(
      `UPDATE faqs
       SET question = COALESCE(?, question),
           answer = COALESCE(?, answer),
           sort_order = COALESCE(?, sort_order),
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND org_id = ?`,
      [
        question && question.length ? question : null,
        answer && answer.length ? answer : null,
        sortOrder != null && !Number.isNaN(sortOrder) ? sortOrder : null,
        isActive,
        faqId,
        orgId,
      ],
    );

    const [rows] = await db.query(
      'SELECT id, question, answer, sort_order, is_active, created_at, updated_at FROM faqs WHERE id = ? AND org_id = ? LIMIT 1',
      [faqId, orgId],
    );
    return res.json({ status: 'success', data: rows[0] ? mapFaq(rows[0]) : null });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to update FAQ.' });
  }
};

const deleteFaq = async (req, res) => {
  try {
    await ensureFaqTable();
    if (!canManageFaqs(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only admin or trainer can manage FAQs.' });
    }
    const orgId = resolveOrgId(req.user);
    const faqId = Number(req.params.faqId);
    if (!orgId || Number.isNaN(faqId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid FAQ request.' });
    }

    const [result] = await db.query(
      'DELETE FROM faqs WHERE id = ? AND org_id = ?',
      [faqId, orgId],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ status: 'error', message: 'FAQ not found.' });
    }

    return res.json({ status: 'success', message: 'FAQ deleted successfully.' });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Unable to delete FAQ.' });
  }
};

module.exports = {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
};

