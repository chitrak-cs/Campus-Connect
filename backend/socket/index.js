const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { ENABLED: RATE_LIMIT_ON } = require('../middleware/rateLimit');
const { chatContent, uuid: uuidSchema } = require('../validation/schemas');

/**
 * Real-time layer: auth, presence, global + group chat, typing, rate limiting.
 * Group rooms are joined ONLY from the server-side membership lookup (never from client input).
 */
function initSocket(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

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
      if (!RATE_LIMIT_ON) return true;
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

    // Sends from one socket run strictly one after another, so they are stored AND broadcast in the
    // order they were sent (handlers are async; without this they could finish out of order).
    let sendQueue = Promise.resolve();
    const enqueue = (fn) => {
      sendQueue = sendQueue.then(fn).catch((err) => console.error('Message error:', err.message));
    };

    socket.on('send_global_message', (data) => {
      // Stamp on arrival (synchronously): stored order then always matches send order.
      const sentAt = new Date();
      enqueue(async () => {
        const parsed = chatContent.safeParse(data?.content);
        if (!parsed.success || throttled()) return;

        const id = uuidv4();
        await pool.query(
          `INSERT INTO messages (id, content, sender_id, is_global, created_at)
           VALUES ($1, $2, $3, TRUE, to_timestamp($4::double precision / 1000.0) AT TIME ZONE 'UTC')`,
          [id, parsed.data, user.id, sentAt.getTime()]
        );

        io.to('global').emit('new_global_message', {
          id,
          content: parsed.data,
          sender_id: user.id,
          sender_name: user.name,
          sender_avatar: user.avatar_url,
          sender_role: user.role,
          is_global: true,
          created_at: sentAt.toISOString(),
        });
      });
    });

    socket.on('send_group_message', (data) => {
      const sentAt = new Date(); // see send_global_message
      enqueue(async () => {
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
          `INSERT INTO messages (id, content, sender_id, group_id, is_global, created_at)
           VALUES ($1, $2, $3, $4, FALSE, to_timestamp($5::double precision / 1000.0) AT TIME ZONE 'UTC')`,
          [id, parsed.data, user.id, group_id, sentAt.getTime()]
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
          created_at: sentAt.toISOString(),
        });
      });
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

  return io;
}

module.exports = { initSocket };
