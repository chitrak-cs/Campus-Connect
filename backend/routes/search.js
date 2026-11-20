const express = require('express');
const { pool } = require('../config/db');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

const router = express.Router();
const searchQuery = z.object({ q: z.string().trim().min(1, 'Type something to search').max(100) });

// Escape LIKE wildcards so "100%" or "a_b" are searched literally
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// GET /api/search?q=  ->  up to 5 approved files + 5 groups the user can see
router.get('/', protect, validate(searchQuery, 'query'), async (req, res) => {
  try {
    const like = `%${likeEscape(req.query.q)}%`;
    const [files, groups] = await Promise.all([
      pool.query(
        `SELECT id, title, subject, file_type, department, year
         FROM files
         WHERE is_approved = TRUE AND (title ILIKE $1 OR subject ILIKE $1)
         ORDER BY download_count DESC, created_at DESC
         LIMIT 5`,
        [like]
      ),
      pool.query(
        `SELECT sg.id, sg.name, sg.department, sg.is_private,
                EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id = sg.id AND gm.user_id = $2) AS is_member
         FROM study_groups sg
         WHERE (sg.name ILIKE $1 OR sg.department ILIKE $1)
           AND (sg.is_private = FALSE
                OR sg.created_by = $2
                OR EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id = sg.id AND gm.user_id = $2))
         ORDER BY sg.created_at DESC
         LIMIT 5`,
        [like, req.user.id]
      ),
    ]);
    res.json({ files: files.rows, groups: groups.rows });
  } catch (err) {
    console.error('search error', err.message);
    res.status(500).json({ message: 'Search failed' });
  }
});

module.exports = router;
