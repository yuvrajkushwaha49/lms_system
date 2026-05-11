const db = require('../config/db');

const resolveOrgId = (user) => user?.org_id || user?.business_id || null;

const ensureMessagesTables = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS direct_conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      user_low_id INT NOT NULL,
      user_high_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_direct_conversation_pair (org_id, user_low_id, user_high_id),
      INDEX idx_direct_conversations_org_user_low (org_id, user_low_id),
      INDEX idx_direct_conversations_org_user_high (org_id, user_high_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS direct_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      reply_to_message_id INT DEFAULT NULL,
      message_text TEXT NOT NULL,
      read_at TIMESTAMP NULL DEFAULT NULL,
      edited_at TIMESTAMP NULL DEFAULT NULL,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_direct_messages_org_conversation (org_id, conversation_id, created_at),
      CONSTRAINT fk_direct_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES direct_conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await db.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL DEFAULT NULL');
  await db.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP NULL DEFAULT NULL');
  await db.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL');
  await db.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_message_id INT DEFAULT NULL');
};

const ensureParticipant = async ({ orgId, userId }) => {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.created_at, b.name AS company_name
     FROM users u
     LEFT JOIN businesses b ON b.id = u.business_id
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ? AND u.business_id = ? AND u.status = 'active' AND LOWER(r.name) = 'student'
     LIMIT 1`,
    [userId, orgId],
  );
  return rows[0] || null;
};

const getPair = (a, b) => {
  const low = Math.min(Number(a), Number(b));
  const high = Math.max(Number(a), Number(b));
  return { low, high };
};

const getConversationForUser = async ({ orgId, currentUserId, conversationId }) => {
  const [rows] = await db.query(
    `SELECT id, user_low_id, user_high_id
     FROM direct_conversations
     WHERE id = ? AND org_id = ? AND (? IN (user_low_id, user_high_id))
     LIMIT 1`,
    [conversationId, orgId, currentUserId],
  );
  return rows[0] || null;
};

const ensureConversationRow = async ({ orgId, currentUserId, participantId }) => {
  const { low, high } = getPair(currentUserId, participantId);
  await db.query(
    `INSERT INTO direct_conversations (org_id, user_low_id, user_high_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
    [orgId, low, high],
  );
  const [rows] = await db.query(
    `SELECT id, org_id, user_low_id, user_high_id, created_at, updated_at
     FROM direct_conversations
     WHERE org_id = ? AND user_low_id = ? AND user_high_id = ?
     LIMIT 1`,
    [orgId, low, high],
  );
  return rows[0] || null;
};

const listConversations = async (req, res) => {
  try {
    await ensureMessagesTables();
    const orgId = resolveOrgId(req.user);
    const currentUserId = Number(req.user?.id);
    if (!orgId || Number.isNaN(currentUserId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid message request.' });
    }

    const [rows] = await db.query(
      `SELECT
         c.id,
         c.created_at,
         c.updated_at,
         CASE WHEN c.user_low_id = ? THEN c.user_high_id ELSE c.user_low_id END AS participant_id,
         u.name AS participant_name,
         u.email AS participant_email,
         u.created_at AS participant_created_at,
         b.name AS participant_company_name,
         CASE WHEN m.deleted_at IS NULL THEN m.message_text ELSE '[deleted]' END AS latest_message,
         m.created_at AS latest_message_at
       FROM direct_conversations c
       JOIN users u ON u.id = CASE WHEN c.user_low_id = ? THEN c.user_high_id ELSE c.user_low_id END
       LEFT JOIN businesses b ON b.id = u.business_id
       LEFT JOIN direct_messages m ON m.id = (
         SELECT dm.id
         FROM direct_messages dm
         WHERE dm.org_id = c.org_id AND dm.conversation_id = c.id
         ORDER BY dm.created_at DESC, dm.id DESC
         LIMIT 1
       )
       WHERE c.org_id = ? AND (? IN (c.user_low_id, c.user_high_id))
       ORDER BY COALESCE(m.created_at, c.updated_at) DESC, c.id DESC`,
      [currentUserId, currentUserId, orgId, currentUserId],
    );

    return res.json({
      status: 'success',
      data: rows.map((row) => ({
        id: Number(row.id),
        participant_id: Number(row.participant_id),
        participant_name: row.participant_name || 'Student',
        participant_email: row.participant_email || '',
        participant_created_at: row.participant_created_at || null,
        participant_company_name: row.participant_company_name || '',
        latest_message: row.latest_message || '',
        latest_message_at: row.latest_message_at || row.updated_at,
      })),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch conversations.' });
  }
};

const ensureConversation = async (req, res) => {
  try {
    await ensureMessagesTables();
    const orgId = resolveOrgId(req.user);
    const currentUserId = Number(req.user?.id);
    const participantId = Number(req.body?.participant_id);
    if (!orgId || Number.isNaN(currentUserId) || Number.isNaN(participantId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid conversation request.' });
    }
    if (currentUserId === participantId) {
      return res.status(400).json({ status: 'error', message: 'Cannot start conversation with yourself.' });
    }

    const participant = await ensureParticipant({ orgId, userId: participantId });
    if (!participant) {
      return res.status(404).json({ status: 'error', message: 'Participant not found.' });
    }

    const conversation = await ensureConversationRow({
      orgId,
      currentUserId,
      participantId,
    });
    return res.json({
      status: 'success',
      data: {
        id: Number(conversation.id),
        participant_id: Number(participant.id),
        participant_name: participant.name || 'Student',
        participant_email: participant.email || '',
        participant_created_at: participant.created_at || null,
        participant_company_name: participant.company_name || '',
      },
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to ensure conversation.' });
  }
};

const listMessages = async (req, res) => {
  try {
    await ensureMessagesTables();
    const orgId = resolveOrgId(req.user);
    const currentUserId = Number(req.user?.id);
    const conversationId = Number(req.params.conversationId);
    if (!orgId || Number.isNaN(currentUserId) || Number.isNaN(conversationId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid message request.' });
    }

    const [conversationRows] = await db.query(
      `SELECT id, user_low_id, user_high_id
       FROM direct_conversations
       WHERE id = ? AND org_id = ? AND (? IN (user_low_id, user_high_id))
       LIMIT 1`,
      [conversationId, orgId, currentUserId],
    );
    if (!conversationRows.length) {
      return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
    }

    const [rows] = await db.query(
      `SELECT
         m.id,
         m.sender_id,
         m.reply_to_message_id,
         m.message_text,
         m.read_at,
         m.edited_at,
         m.deleted_at,
         m.created_at,
         rm.message_text AS reply_to_message_text,
         rm.deleted_at AS reply_to_deleted_at,
         rm.sender_id AS reply_to_sender_id
       FROM direct_messages m
       LEFT JOIN direct_messages rm ON rm.id = m.reply_to_message_id AND rm.org_id = m.org_id
       WHERE m.org_id = ? AND m.conversation_id = ?
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 300`,
      [orgId, conversationId],
    );

    return res.json({
      status: 'success',
      data: rows.map((row) => ({
        id: Number(row.id),
        conversation_id: conversationId,
        sender_id: Number(row.sender_id),
        reply_to_message_id: row.reply_to_message_id ? Number(row.reply_to_message_id) : null,
        reply_to_message_text: row.reply_to_deleted_at ? "[deleted]" : (row.reply_to_message_text || null),
        reply_to_sender_id: row.reply_to_sender_id ? Number(row.reply_to_sender_id) : null,
        message_text: row.deleted_at ? '' : (row.message_text || ''),
        is_deleted: Boolean(row.deleted_at),
        read_at: row.read_at || null,
        edited_at: row.edited_at || null,
        can_edit: Number(row.sender_id) === currentUserId && !row.deleted_at,
        can_delete: Number(row.sender_id) === currentUserId && !row.deleted_at,
        created_at: row.created_at,
      })),
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to fetch messages.' });
  }
};

const createMessage = async (req, res) => {
  try {
    await ensureMessagesTables();
    const orgId = resolveOrgId(req.user);
    const currentUserId = Number(req.user?.id);
    const conversationId = Number(req.params.conversationId);
    const messageText = String(req.body?.message_text || '').trim();
    const replyToMessageIdRaw = req.body?.reply_to_message_id;
    const replyToMessageId = replyToMessageIdRaw != null && replyToMessageIdRaw !== ''
      ? Number(replyToMessageIdRaw)
      : null;
    if (!orgId || Number.isNaN(currentUserId) || Number.isNaN(conversationId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid message request.' });
    }
    if (!messageText) {
      return res.status(400).json({ status: 'error', message: 'Message text is required.' });
    }
    if (replyToMessageId != null && Number.isNaN(replyToMessageId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid reply message id.' });
    }

    const [conversationRows] = await db.query(
      `SELECT id
       FROM direct_conversations
       WHERE id = ? AND org_id = ? AND (? IN (user_low_id, user_high_id))
       LIMIT 1`,
      [conversationId, orgId, currentUserId],
    );
    if (!conversationRows.length) {
      return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
    }

    if (replyToMessageId != null) {
      const [replyRows] = await db.query(
        `SELECT id FROM direct_messages
         WHERE id = ? AND org_id = ? AND conversation_id = ?
         LIMIT 1`,
        [replyToMessageId, orgId, conversationId],
      );
      if (!replyRows.length) {
        return res.status(404).json({ status: 'error', message: 'Reply target message not found.' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO direct_messages (org_id, conversation_id, sender_id, reply_to_message_id, message_text)
       VALUES (?, ?, ?, ?, ?)`,
      [orgId, conversationId, currentUserId, replyToMessageId, messageText],
    );
    await db.query(
      'UPDATE direct_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND org_id = ?',
      [conversationId, orgId],
    );

    const [rows] = await db.query(
      `SELECT id, sender_id, message_text, read_at, edited_at, deleted_at, created_at
       FROM direct_messages
       WHERE id = ? AND org_id = ? LIMIT 1`,
      [result.insertId, orgId],
    );

    return res.status(201).json({
      status: 'success',
      data: rows[0]
        ? {
            id: Number(rows[0].id),
            conversation_id: conversationId,
            sender_id: Number(rows[0].sender_id),
            message_text: rows[0].deleted_at ? '' : (rows[0].message_text || ''),
            is_deleted: Boolean(rows[0].deleted_at),
            read_at: rows[0].read_at || null,
            edited_at: rows[0].edited_at || null,
            created_at: rows[0].created_at,
          }
        : null,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message || 'Failed to send message.' });
  }
};

module.exports = {
  listConversations,
  ensureConversation,
  listMessages,
  createMessage,
  markConversationRead: async (req, res) => {
    try {
      await ensureMessagesTables();
      const orgId = resolveOrgId(req.user);
      const currentUserId = Number(req.user?.id);
      const conversationId = Number(req.params.conversationId);
      if (!orgId || Number.isNaN(currentUserId) || Number.isNaN(conversationId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid read request.' });
      }
      const conversation = await getConversationForUser({ orgId, currentUserId, conversationId });
      if (!conversation) {
        return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
      }
      const [result] = await db.query(
        `UPDATE direct_messages
         SET read_at = CURRENT_TIMESTAMP
         WHERE org_id = ? AND conversation_id = ? AND sender_id != ? AND read_at IS NULL AND deleted_at IS NULL`,
        [orgId, conversationId, currentUserId],
      );
      return res.json({ status: 'success', data: { updated_count: Number(result.affectedRows || 0) } });
    } catch (e) {
      return res.status(500).json({ status: 'error', message: e.message || 'Failed to mark as read.' });
    }
  },
  updateMessage: async (req, res) => {
    try {
      await ensureMessagesTables();
      const orgId = resolveOrgId(req.user);
      const currentUserId = Number(req.user?.id);
      const conversationId = Number(req.params.conversationId);
      const messageId = Number(req.params.messageId);
      const messageText = String(req.body?.message_text || '').trim();
      if (!orgId || Number.isNaN(currentUserId) || Number.isNaN(conversationId) || Number.isNaN(messageId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid message update request.' });
      }
      if (!messageText) {
        return res.status(400).json({ status: 'error', message: 'Message text is required.' });
      }
      const conversation = await getConversationForUser({ orgId, currentUserId, conversationId });
      if (!conversation) {
        return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
      }
      const [rows] = await db.query(
        `SELECT id, sender_id, deleted_at
         FROM direct_messages
         WHERE id = ? AND org_id = ? AND conversation_id = ?
         LIMIT 1`,
        [messageId, orgId, conversationId],
      );
      if (!rows.length) {
        return res.status(404).json({ status: 'error', message: 'Message not found.' });
      }
      const row = rows[0];
      if (Number(row.sender_id) !== currentUserId) {
        return res.status(403).json({ status: 'error', message: 'You can edit only your own messages.' });
      }
      if (row.deleted_at) {
        return res.status(400).json({ status: 'error', message: 'Deleted message cannot be edited.' });
      }
      await db.query(
        `UPDATE direct_messages
         SET message_text = ?, edited_at = CURRENT_TIMESTAMP
         WHERE id = ? AND org_id = ? AND conversation_id = ?`,
        [messageText, messageId, orgId, conversationId],
      );
      await db.query(
        'UPDATE direct_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND org_id = ?',
        [conversationId, orgId],
      );
      return res.json({ status: 'success', data: { id: messageId, message_text: messageText } });
    } catch (e) {
      return res.status(500).json({ status: 'error', message: e.message || 'Failed to edit message.' });
    }
  },
  deleteMessage: async (req, res) => {
    try {
      await ensureMessagesTables();
      const orgId = resolveOrgId(req.user);
      const currentUserId = Number(req.user?.id);
      const conversationId = Number(req.params.conversationId);
      const messageId = Number(req.params.messageId);
      if (!orgId || Number.isNaN(currentUserId) || Number.isNaN(conversationId) || Number.isNaN(messageId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid message delete request.' });
      }
      const conversation = await getConversationForUser({ orgId, currentUserId, conversationId });
      if (!conversation) {
        return res.status(404).json({ status: 'error', message: 'Conversation not found.' });
      }
      const [rows] = await db.query(
        `SELECT id, sender_id, deleted_at
         FROM direct_messages
         WHERE id = ? AND org_id = ? AND conversation_id = ?
         LIMIT 1`,
        [messageId, orgId, conversationId],
      );
      if (!rows.length) {
        return res.status(404).json({ status: 'error', message: 'Message not found.' });
      }
      const row = rows[0];
      if (Number(row.sender_id) !== currentUserId) {
        return res.status(403).json({ status: 'error', message: 'You can delete only your own messages.' });
      }
      if (!row.deleted_at) {
        await db.query(
          `UPDATE direct_messages
           SET deleted_at = CURRENT_TIMESTAMP, edited_at = NULL, message_text = ''
           WHERE id = ? AND org_id = ? AND conversation_id = ?`,
          [messageId, orgId, conversationId],
        );
      }
      await db.query(
        'UPDATE direct_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND org_id = ?',
        [conversationId, orgId],
      );
      return res.json({ status: 'success', data: { id: messageId, deleted: true } });
    } catch (e) {
      return res.status(500).json({ status: 'error', message: e.message || 'Failed to delete message.' });
    }
  },
};

