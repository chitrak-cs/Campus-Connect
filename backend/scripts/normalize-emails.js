/**
 * One-off: lower-case and trim every user email (Phase 4.2 / H4).
 * Run ONLY against production, ONLY after the owner approves, and right before deploying
 * the new backend (the old backend looks emails up case-sensitively).
 *
 *   node scripts/normalize-emails.js            # dry run: shows what would change
 *   node scripts/normalize-emails.js --apply    # runs the UPDATE in a transaction
 */
require('dotenv').config();
const { pool } = require('../config/db');

(async () => {
  const apply = process.argv.includes('--apply');
  const { rows: dups } = await pool.query(
    `SELECT LOWER(TRIM(email)) AS e, COUNT(*)::int AS n FROM users GROUP BY 1 HAVING COUNT(*) > 1`
  );
  if (dups.length) {
    console.error('Duplicate emails differing only by case/whitespace; resolve these first:', dups);
    process.exit(1);
  }
  const { rows: changes } = await pool.query(
    `SELECT id, email, LOWER(TRIM(email)) AS normalized FROM users WHERE email <> LOWER(TRIM(email))`
  );
  console.log(`${changes.length} email(s) would change:`);
  changes.forEach((c) => console.log(`  ${c.email} -> ${c.normalized}`));

  if (!apply) { console.log('Dry run. Re-run with --apply to update.'); process.exit(0); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`UPDATE users SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))`);
    await client.query('COMMIT');
    console.log(`Updated ${r.rowCount} row(s).`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
