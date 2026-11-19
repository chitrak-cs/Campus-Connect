const { pool } = require('../config/db');

const PAGE_DEFAULT = 30;
const PAGE_MAX = 50;

// Parse ?limit and ?before (ISO timestamp cursor). Invalid values fall back to safe defaults.
const parsePaging = (query) => {
  const limit = Math.min(PAGE_MAX, Math.max(1, parseInt(query.limit) || PAGE_DEFAULT));
  const t = query.before ? Date.parse(query.before) : NaN;
  const before = Number.isNaN(t) ? null : new Date(t).toISOString();
  return { limit, before };
};

// Deleted messages keep their row (and position) but never leak their content.
const SELECT_COLS = `
  m.id, m.sender_id, m.group_id, m.is_global, m.created_at, m.deleted_at,
  CASE WHEN m.deleted_at IS NULL THEN m.content ELSE '' END AS content,
  u.name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role`;

// Newest-first page, returned oldest-first for rendering. hasMore tells the UI to show "Load older".
const fetchPage = async (whereSql, whereParams, { limit, before }) => {
  const params = [...whereParams];
  let cursor = '';
  if (before) {
    params.push(before);
    cursor = `AND m.created_at < $${params.length}::timestamp`;
  }
  params.push(limit + 1);
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS}
     FROM messages m JOIN users u ON m.sender_id = u.id
     WHERE ${whereSql} ${cursor}
     ORDER BY m.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse(), hasMore };
};

// GET /api/messages/global?before=<ISO>&limit=30
const getGlobalMessages = async (req, res) => {
  try {
    res.json(await fetchPage('m.is_global = TRUE', [], parsePaging(req.query)));
  } catch (err) {
    console.error('Global fetch error:', err.message);
    res.status(500).json({ message: 'Error fetching messages' });
  }
};

// GET /api/messages/group/:groupId?before=<ISO>&limit=30
const getGroupMessages = async (req, res) => {
  try {
    const { rows: membership } = await pool.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.groupId, req.user.id]
    );
    if (!membership.length && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not a member of this group' });
    }
    res.json(await fetchPage('m.group_id = $1', [req.params.groupId], parsePaging(req.query)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching group messages' });
  }
};

// DELETE /api/messages/:id - soft delete (sender or site admin); broadcasts message_deleted
const deleteMessage = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, sender_id, group_id, is_global, deleted_at FROM messages WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Message not found' });
    const msg = rows[0];
    if (msg.sender_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }
    if (!msg.deleted_at) {
      await pool.query(`UPDATE messages SET deleted_at = NOW() WHERE id = $1`, [msg.id]);
    }
    const room = msg.is_global ? 'global' : `group:${msg.group_id}`;
    req.app.get('io')?.to(room).emit('message_deleted', { id: msg.id, group_id: msg.group_id || null });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting message' });
  }
};

module.exports = { getGlobalMessages, getGroupMessages, deleteMessage };
