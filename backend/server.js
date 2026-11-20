require('dotenv').config();
require('./config/network');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { initDB, pool, cleanupOtps } = require('./config/db');
const { protect } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');

// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const groupRoutes = require('./routes/groups');
const adminRoutes = require('./routes/admin');
const messageRoutes = require('./routes/messages');
const publicRoutes = require('./routes/public');
const searchRoutes = require('./routes/search');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

// Render sits behind one proxy; needed for correct client IPs in rate limiting
app.set('trust proxy', 1);

// Allowed browser origins (comma-separated CLIENT_URLS; CLIENT_URL kept as fallback)
const ALLOWED_ORIGINS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

// ─── Socket.IO ───────────────────────────────────────────────
const io = initSocket(server, ALLOWED_ORIGINS);
app.set('io', io);

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
app.use('/api/search', searchRoutes);

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
