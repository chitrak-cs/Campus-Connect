/**
 * Lists Cloudinary assets in the project folder that have no row in `files`.
 * DRY-RUN by default. Deleting requires --delete (and the owner's OK).
 * NOTE: it uses whatever DATABASE_URI is in .env; point it at PRODUCTION when you want
 * the real answer (a dev branch may be out of date).
 *
 *   node scripts/cleanup-orphans.js            # report only
 *   node scripts/cleanup-orphans.js --delete   # actually delete orphans
 */
require('dotenv').config();
const { cloudinary } = require('../config/cloudinary');
const { pool } = require('../config/db');

const FOLDER = 'Jadavpur_university/';
const AVATARS = `${FOLDER}avatars/`;
const doDelete = process.argv.includes('--delete');

async function listAll(resource_type) {
  const out = [];
  let next_cursor;
  do {
    const res = await cloudinary.api.resources({
      type: 'upload', resource_type, prefix: FOLDER, max_results: 500, next_cursor,
    });
    out.push(...res.resources.map((r) => ({ public_id: r.public_id, resource_type, bytes: r.bytes })));
    next_cursor = res.next_cursor;
  } while (next_cursor);
  return out;
}

(async () => {
  const { rows } = await pool.query(`SELECT cloudinary_public_id FROM files WHERE cloudinary_public_id IS NOT NULL`);
  const known = new Set(rows.map((r) => r.cloudinary_public_id));
  const { rows: avatarRows } = await pool.query(`SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL`);
  const avatarUrls = avatarRows.map((r) => r.avatar_url);

  const assets = [...(await listAll('raw')), ...(await listAll('image'))];
  const orphans = assets.filter(
    (a) => !known.has(a.public_id) &&
      !(a.public_id.startsWith(AVATARS) && avatarUrls.some((u) => u.includes(a.public_id)))
  );

  console.log(`Cloudinary assets: ${assets.length}, DB file rows: ${known.size}, orphans: ${orphans.length}`);
  orphans.forEach((o) => console.log(`  ${o.resource_type}\t${o.public_id}\t${o.bytes} bytes`));

  if (doDelete && orphans.length) {
    for (const o of orphans) {
      const r = await cloudinary.uploader.destroy(o.public_id, { resource_type: o.resource_type });
      console.log(`deleted ${o.public_id}: ${r.result}`);
    }
  } else if (orphans.length) {
    console.log('Dry run. Re-run with --delete to remove them.');
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
