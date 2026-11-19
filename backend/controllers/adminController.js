const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ✅ GET /api/admin/stats (single query)
const getStats = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM files WHERE is_approved = TRUE) AS files,
        (SELECT COUNT(*)::int FROM files WHERE is_approved = FALSE) AS pending,
        (SELECT COUNT(*)::int FROM study_groups) AS groups,
        (SELECT COUNT(*)::int FROM messages) AS messages,
        (SELECT COALESCE(SUM(download_count),0)::int FROM files) AS downloads,
        (SELECT COUNT(*)::int FROM users WHERE requested_role IS NOT NULL) AS "pendingRoleRequests"
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('getStats error', err);
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

// ✅ GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    let where = [];
    let params = [];

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length - 1} OR email ILIKE $${params.length})`);
    }

    if (role) {
      params.push(role);
      where.push(`role = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT id, name, email, role, requested_role, department, year, is_active, created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    );

    res.json({ users: rows, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// Would removing admin power from `userId` leave the platform with no active admin?
const isLastActiveAdmin = async (userId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active = TRUE AND id <> $1`,
    [userId]
  );
  return rows[0].n === 0;
};

// ✅ PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { role, is_active, department, year } = req.body;
    const targetId = req.params.id;

    const { rows: target } = await pool.query(`SELECT id, role, is_active FROM users WHERE id = $1`, [targetId]);
    if (!target.length) return res.status(404).json({ message: 'User not found' });

    const changingRole = role !== undefined && role !== target[0].role;
    const deactivating = is_active === false && target[0].is_active;

    if (targetId === req.user.id && (changingRole || deactivating)) {
      return res.status(400).json({ message: "You can't change your own role or deactivate yourself" });
    }
    if (target[0].role === 'admin' && (changingRole || deactivating) && (await isLastActiveAdmin(targetId))) {
      return res.status(400).json({ message: "Can't demote or deactivate the last active admin" });
    }

    await pool.query(
      `UPDATE users SET
        role = COALESCE($1, role),
        is_active = COALESCE($2, is_active),
        department = COALESCE($3, department),
        year = COALESCE($4, year),
        requested_role = CASE WHEN $1 = 'faculty' THEN NULL ELSE requested_role END,
        token_version = token_version + CASE WHEN $5 THEN 1 ELSE 0 END
       WHERE id = $6`,
      [
        role ?? null,
        is_active ?? null,
        department || null,
        year || null,
        deactivating,
        targetId,
      ]
    );

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating user' });
  }
};

// ✅ DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }
    const { rows: target } = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.params.id]);
    if (!target.length) return res.status(404).json({ message: 'User not found' });
    if (target[0].role === 'admin' && (await isLastActiveAdmin(req.params.id))) {
      return res.status(400).json({ message: "Can't delete the last active admin" });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting user' });
  }
};

// ✅ POST /api/admin/users
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, year } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [email]
    );

    if (existing.length) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await pool.query(
      `INSERT INTO users (id, name, email, password, role, department, year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        name,
        email,
        hashed,
        role || 'student',
        department || null,
        year || null
      ]
    );

    res.status(201).json({ message: 'User created', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating user' });
  }
};

// ✅ POST /api/admin/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, content, priority } = req.body;

    const id = uuidv4();

    await pool.query(
      `INSERT INTO announcements (id, title, content, priority, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, title, content, priority || 'low', req.user.id]
    );

    res.status(201).json({ message: 'Announcement created', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating announcement' });
  }
};

// ✅ GET /api/admin/announcements
const getAnnouncements = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, u.name AS creator_name
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `);

    res.json({ announcements: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
};

// ✅ DELETE /api/admin/announcements/:id
const deleteAnnouncement = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM announcements WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting announcement' });
  }
};

// ✅ Role requests (faculty approval)
const getRoleRequests = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, department, year, requested_role, created_at
       FROM users WHERE requested_role IS NOT NULL ORDER BY created_at ASC`
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching role requests' });
  }
};

const approveRoleRequest = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE users SET role = requested_role, requested_role = NULL
       WHERE id = $1 AND requested_role IS NOT NULL`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: 'No pending request for this user' });
    res.json({ message: 'Role approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error approving request' });
  }
};

const rejectRoleRequest = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE users SET requested_role = NULL WHERE id = $1 AND requested_role IS NOT NULL`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: 'No pending request for this user' });
    res.json({ message: 'Request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error rejecting request' });
  }
};

module.exports = {
  getRoleRequests,
  approveRoleRequest,
  rejectRoleRequest,
  getStats,
  getUsers,
  updateUser,
  deleteUser,
  createUser,
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement
};