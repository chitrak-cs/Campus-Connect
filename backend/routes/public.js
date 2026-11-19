const express = require('express');
const { pool } = require('../config/db');
const { publicLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// GET /api/public/stats — real, non-sensitive counts for the landing page (cached 5 min)
let cache = { at: 0, data: null };
const TTL_MS = 5 * 60 * 1000;

router.get('/stats', publicLimiter, async (req, res) => {
  try {
    if (!cache.data || Date.now() - cache.at > TTL_MS) {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE is_active = TRUE) AS users,
          (SELECT COUNT(*)::int FROM files WHERE is_approved = TRUE) AS files,
          (SELECT COUNT(*)::int FROM study_groups WHERE is_private = FALSE) AS groups
      `);
      cache = { at: Date.now(), data: rows[0] };
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(cache.data);
  } catch (err) {
    console.error('public stats error', err.message);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

module.exports = router;
