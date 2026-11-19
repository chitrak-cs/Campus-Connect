const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { pool } = require('../config/db');

const newInviteCode = () => crypto.randomBytes(6).toString('base64url').slice(0, 8);

// Keep live socket rooms in sync with membership changes
const roomOps = {
  join: (req, userId, groupId) =>
    req.app.get('io')?.in(`user:${userId}`).socketsJoin(`group:${groupId}`),
  leave: (req, userId, groupId) =>
    req.app.get('io')?.in(`user:${userId}`).socketsLeave(`group:${groupId}`),
  closeRoom: (req, groupId) =>
    req.app.get('io')?.in(`group:${groupId}`).socketsLeave(`group:${groupId}`),
};

const COLORS = ['#C9A84C', '#1A5FA8', '#1A7A4A', '#8B4A9C', '#C0392B', '#E67E22', '#2980B9'];

// ✅ POST /api/groups
const createGroup = async (req, res) => {
  try {
    const { name, description, department, is_private } = req.body;

    const id = uuidv4();
    const inviteCode = is_private ? newInviteCode() : null;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    await pool.query(
      `INSERT INTO study_groups 
       (id, name, description, department, created_by, is_private, avatar_color, invite_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        name,
        description || null,
        department || null,
        req.user.id,
        is_private ? true : false,
        color,
        inviteCode
      ]
    );

    // Add creator as admin
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1,$2,$3)`,
      [id, req.user.id, 'admin']
    );

    const { rows } = await pool.query(
      `SELECT sg.*, u.name AS creator_name,
       (SELECT COUNT(*)::int FROM group_members WHERE group_id = sg.id) AS member_count
       FROM study_groups sg
       JOIN users u ON sg.created_by = u.id
       WHERE sg.id = $1`,
      [id]
    );

    roomOps.join(req, req.user.id, id);
    res.status(201).json({ group: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating group' });
  }
};

// ✅ GET /api/groups
const getGroups = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sg.id, sg.name, sg.description, sg.department, sg.created_by,
        sg.is_private, sg.avatar_color, sg.created_at, u.name AS creator_name,
        CASE WHEN sg.created_by = $1 OR EXISTS(
          SELECT 1 FROM group_members WHERE group_id = sg.id AND user_id = $1 AND role = 'admin'
        ) THEN sg.invite_code END AS invite_code,
        (SELECT COUNT(*)::int FROM group_members WHERE group_id = sg.id) AS member_count,
        EXISTS(
          SELECT 1 FROM group_members 
          WHERE group_id = sg.id AND user_id = $1
        ) AS is_member
       FROM study_groups sg
       JOIN users u ON sg.created_by = u.id
       WHERE sg.is_private = FALSE
          OR sg.created_by = $1
          OR EXISTS(
            SELECT 1 FROM group_members 
            WHERE group_id = sg.id AND user_id = $1
          )
       ORDER BY sg.created_at DESC`,
      [req.user.id]
    );

    res.json({ groups: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching groups' });
  }
};

// ✅ POST /api/groups/:id/join
const joinGroup = async (req, res) => {
  try {
    const { rows: group } = await pool.query(
      `SELECT * FROM study_groups WHERE id = $1`,
      [req.params.id]
    );

    if (!group.length) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group[0].is_private && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'This group is invite-only' });
    }

    const { rows: existing } = await pool.query(
      `SELECT id FROM group_members 
       WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (existing.length) {
      return res.status(409).json({ message: 'Already a member' });
    }

    await pool.query(
      `INSERT INTO group_members (group_id, user_id)
       VALUES ($1,$2)`,
      [req.params.id, req.user.id]
    );

    roomOps.join(req, req.user.id, req.params.id);
    res.json({ message: 'Joined group successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error joining group' });
  }
};

// ✅ DELETE /api/groups/:id/leave
const leaveGroup = async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM group_members 
       WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    roomOps.leave(req, req.user.id, req.params.id);
    res.json({ message: 'Left group' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error leaving group' });
  }
};

// ✅ GET /api/groups/:id/members — private groups: members/site admins only; emails: site admins only
const getMembers = async (req, res) => {
  try {
    const { rows: group } = await pool.query(`SELECT is_private FROM study_groups WHERE id = $1`, [req.params.id]);
    if (!group.length) return res.status(404).json({ message: 'Group not found' });

    const isSiteAdmin = req.user.role === 'admin';
    if (group[0].is_private && !isSiteAdmin) {
      const { rows: m } = await pool.query(
        `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (!m.length) return res.status(403).json({ message: 'Not a member of this group' });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.name, ${isSiteAdmin ? 'u.email,' : ''} u.department, u.year,
              u.avatar_url, gm.role, gm.joined_at
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.role DESC, gm.joined_at ASC`,
      [req.params.id]
    );

    res.json({ members: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching members' });
  }
};

// ✅ POST /api/groups/join-by-code
const joinByCode = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id FROM study_groups WHERE invite_code = $1`, [req.body.code]);
    if (!rows.length) return res.status(404).json({ message: 'Invalid invite code' });

    const groupId = rows[0].id;
    await pool.query(
      `INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, req.user.id]
    );
    roomOps.join(req, req.user.id, groupId);
    res.json({ message: 'Joined group successfully', group_id: groupId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error joining group' });
  }
};

// ✅ DELETE /api/groups/:id
const deleteGroup = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM study_groups WHERE id = $1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const group = rows[0];

    if (group.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await pool.query(
      `DELETE FROM study_groups WHERE id = $1`,
      [req.params.id]
    );

    roomOps.closeRoom(req, req.params.id);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting group' });
  }
};

module.exports = {
  createGroup,
  getGroups,
  joinGroup,
  leaveGroup,
  getMembers,
  joinByCode,
  deleteGroup,
};