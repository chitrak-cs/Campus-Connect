// Shared test setup. Tests run against TEST_DATABASE_URI (the Neon `dev` branch), never production.
require('dotenv').config();
if (!process.env.TEST_DATABASE_URI) {
  throw new Error('Set TEST_DATABASE_URI (the Neon dev branch connection string) to run tests.');
}
process.env.DATABASE_URI = process.env.TEST_DATABASE_URI;
process.env.NODE_ENV = 'test';
process.env.ENABLE_RATE_LIMIT = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Capture outgoing email instead of sending it (must be installed BEFORE the app loads)
const sentMail = [];
const mailerPath = require.resolve('../utils/mailer');
require.cache[mailerPath] = { id: mailerPath, filename: mailerPath, loaded: true, exports: { sendEmail: async (m) => { sentMail.push(m); } } };

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const { app, server } = require('../server');
const { pool, initDB } = require('../config/db');
const { generateToken } = require('../controllers/authController');

const RUN = Date.now().toString(36);
const createdUserIds = [];
const createdGroupIds = [];
let port;

async function setup() {
  await initDB();
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
}

async function teardown() {
  if (createdGroupIds.length) await pool.query('DELETE FROM study_groups WHERE id = ANY($1)', [createdGroupIds]);
  if (createdUserIds.length) await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

// Insert a verified user directly (cheap bcrypt) and return { id, email, password, token }
async function makeUser({ role = 'student', active = true, password = 'TestPassw0rd!' } = {}) {
  const id = uuidv4();
  const email = `t-${RUN}-${createdUserIds.length}-${role}@example.test`;
  const hash = await bcrypt.hash(password, 4);
  await pool.query(
    `INSERT INTO users (id, name, email, password, role, is_verified, is_active) VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
    [id, `Test ${role}`, email, hash, role, active]
  );
  createdUserIds.push(id);
  return { id, email, password, role, token: generateToken({ id, token_version: 0 }) };
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
const api = () => request(app);

const lastOtpFor = (email) => {
  const mail = [...sentMail].reverse().find((m) => m.to === email);
  return mail && (mail.text.match(/(\d{6})/) || [])[1];
};

function connectSocket(user) {
  return new Promise((resolve, reject) => {
    const s = ioClient(`http://localhost:${port}`, { auth: { token: user.token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => setTimeout(() => resolve(s), 300));   // let server-side room joins finish
    s.on('connect_error', reject);
  });
}

const trackGroup = (id) => createdGroupIds.push(id);
const trackUser = (id) => createdUserIds.push(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Poll until predicate() is truthy (for positive assertions; slower databases just take longer)
async function waitFor(predicate, { timeout = 10000, interval = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return true;
    await sleep(interval);
  }
  return false;
}

module.exports = { setup, teardown, makeUser, auth, api, pool, sentMail, lastOtpFor, connectSocket, trackGroup, trackUser, sleep, waitFor, RUN };
