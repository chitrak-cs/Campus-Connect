require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initDB, pool, cleanupOtps } = require('./config/db');
const { protect } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const { chatContent, uuid: uuidSchema } = require('./validation/schemas');

// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const groupRoutes = require('./routes/groups');
const adminRoutes = require('./routes/admin');
const messageRoutes = require('./routes/messages');
const publicRoutes = require('./routes/public');

const app = express();
const server = http.createServer(app);

// Render sits behind one proxy; needed for correct client IPs in rate limiting
app.set('trust proxy', 1);

// Allowed browser origins (comma-separated CLIENT_URLS; CLIENT_URL kept as fallback)
const ALLOWED_ORIGINS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

// ─── Socket.IO Setup ─────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true },
});
app.set('io', io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, name, role, avatar_url, department, token_version
       FROM users WHERE id = $1 AND is_active = TRUE`,
      [decoded.id]
    );
    if (!rows.length) return next(new Error('User not found'));
    if ((decoded.tv ?? 0) !== rows[0].token_version) return next(new Error('Session expired'));

    delete rows[0].token_version;
    socket.user = rows[0];
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Presence: user can have several sockets (tabs); offline only when the last one closes
const presence = new Map(); // userId -> { user, sockets:Set }
let presenceTimer = null;
const onlineList = () => Array.from(presence.values()).map((v) => v.user);
const broadcastPresence = () => {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    io.emit('online_users', onlineList());
  }, 1000);
};

// Token bucket: 8 messages per 10s per socket
const makeBucket = () => {
  let tokens = 8;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(8, tokens + ((now - last) / 10000) * 8);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
};

io.on('connection', (socket) => {
  const user = socket.user;
  const allow = makeBucket();
  let warned = false;

  const entry = presence.get(user.id) || { user, sockets: new Set() };
  entry.sockets.add(socket.id);
  presence.set(user.id, entry);
  broadcastPresence();
  socket.emit('online_users', onlineList()); // late joiners get the list immediately
  socket.on('get_online_users', () => socket.emit('online_users', onlineList()));

  socket.join('global');
  socket.join(`user:${user.id}`);

  // The ONLY way a socket enters group rooms: server-side membership lookup.
  // Handlers below are registered synchronously; group handlers await this promise.
  const roomsReady = pool
    .query(`SELECT group_id FROM group_members WHERE user_id = $1`, [user.id])
    .then(({ rows }) => rows.forEach((r) => socket.join(`group:${r.group_id}`)))
    .catch((err) => console.error('Failed to load group rooms:', err.message));

  // Deprecated: clients can no longer pick rooms
  socket.on('join_groups', () => {});

  // Site admins may watch any group live (read-only access is also granted by REST)
  socket.on('admin_watch_group', (groupId) => {
    if (user.role === 'admin' && uuidSchema.safeParse(groupId).success) socket.join(`group:${groupId}`);
  });

  const throttled = () => {
    if (allow()) { warned = false; return false; }
    if (!warned) { warned = true; socket.emit('rate_limited'); }
    return true;
  };

  socket.on('send_global_message', async (data) => {
    try {
      const parsed = chatContent.safeParse(data?.content);
      if (!parsed.success || throttled()) return;

      const id = uuidv4();
      await pool.query(
        `INSERT INTO messages (id, content, sender_id, is_global) VALUES ($1, $2, $3, TRUE)`,
        [id, parsed.data, user.id]
      );

      io.to('global').emit('new_global_message', {
        id,
        content: parsed.data,
        sender_id: user.id,
        sender_name: user.name,
        sender_avatar: user.avatar_url,
        sender_role: user.role,
        is_global: true,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Message error:', err.message);
    }
  });

  socket.on('send_group_message', async (data) => {
    try {
      const parsed = chatContent.safeParse(data?.content);
      const gid = uuidSchema.safeParse(data?.group_id);
      if (!parsed.success || !gid.success || throttled()) return;
      const group_id = gid.data;

      await roomsReady;
      // Must be in the room (set up server-side) AND still a member in the DB
      if (!socket.rooms.has(`group:${group_id}`)) return;
      const { rows: membership } = await pool.query(
        `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [group_id, user.id]
      );
      if (!membership.length && user.role !== 'admin') return;

      const { rows: g } = await pool.query(`SELECT name FROM study_groups WHERE id = $1`, [group_id]);
      if (!g.length) return;

      const id = uuidv4();
      await pool.query(
        `INSERT INTO messages (id, content, sender_id, group_id, is_global) VALUES ($1, $2, $3, $4, FALSE)`,
        [id, parsed.data, user.id, group_id]
      );

      io.to(`group:${group_id}`).emit('new_group_message', {
        id,
        content: parsed.data,
        sender_id: user.id,
        sender_name: user.name,
        sender_avatar: user.avatar_url,
        sender_role: user.role,
        group_id,
        group_name: g[0].name,
        is_global: false,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Group message error:', err.message);
    }
  });

  socket.on('typing_global', () => {
    socket.to('global').emit('user_typing', { name: user.name, room: 'global' });
  });

  socket.on('typing_group', async (payload) => {
    await roomsReady;
    const gid = uuidSchema.safeParse(payload?.group_id);
    if (!gid.success || !socket.rooms.has(`group:${gid.data}`)) return;
    socket.to(`group:${gid.data}`).emit('user_typing', { name: user.name, room: gid.data });
  });

  socket.on('disconnect', () => {
    const e = presence.get(user.id);
    if (e) {
      e.sockets.delete(socket.id);
      if (!e.sockets.size) presence.delete(user.id);
    }
    broadcastPresence();
  });
});

// ─── Express Middleware ───────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Health check (before rate limiting so uptime pings never get blocked)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api', apiLimiter);

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/public', publicRoutes);

app.get('/api/announcements', protect, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, u.name as creator_name
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);
    res.json({ announcements: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
});

// ─── Error handling ──────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      message: tooBig ? (err.field === 'avatar' ? 'Image too large (max 2 MB)' : 'File too large (max 50 MB)') : err.message,
    });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('Unhandled error:', err);
  res.status(status).json({
    message: status >= 500 ? 'Internal server error' : err.message,
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// ─── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

initDB()
  .then(() => {
    cleanupOtps();
    setInterval(cleanupOtps, 60 * 60 * 1000).unref();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO ready`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });
