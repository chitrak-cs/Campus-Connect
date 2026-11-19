require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool, initDB } = require('./config/db');

// Local/dev only. Admin credentials come from env, never from source.
async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run seed in production.');
    process.exit(1);
  }
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || password.length < 8) {
    console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 8 chars) in backend/.env');
    process.exit(1);
  }

  await initDB();

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
  if (existing.length) {
    console.log('✅ Admin already exists. Skipping seed.');
    process.exit(0);
  }

  const adminId = uuidv4();
  const hashed = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO users (id, name, email, password, role, department, is_verified) VALUES ($1, $2, $3, $4, 'admin', 'Administration', TRUE)",
    [adminId, 'Admin', email, hashed]
  );

  await pool.query(
    "INSERT INTO announcements (id, title, content, priority, created_by) VALUES ($1, $2, $3, 'high', $4)",
    [uuidv4(), 'Welcome to Campus Connect!',
     'This platform is your central hub for study materials, campus chat, and study groups.',
     adminId]
  );

  console.log(`✅ Seed complete. Admin created: ${email}`);
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
