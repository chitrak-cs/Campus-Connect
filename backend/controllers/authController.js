const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { sendEmail } = require('../utils/mailer');
const { otpEmail } = require('../utils/emailTemplates');

const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_MIN = 10;
const RESEND_COOLDOWN_SEC = 60;
const RESEND_MAX_PER_HOUR = 5;
const PUBLIC_USER_COLS =
  'id,name,email,role,requested_role,department,year,avatar_url,is_active,is_verified';

const generateToken = (user) =>
  jwt.sign({ id: user.id, tv: user.token_version ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const hashOtp = (id, code) =>
  crypto.createHash('sha256').update(`${id}:${code}`).digest('hex');

const safeEqualHex = (a, b) => {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const emailDomainAllowed = (email) => {
  const list = (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return true;
  return list.includes(email.split('@')[1]);
};

// Create an OTP; previous unused OTPs of the same purpose for this user are invalidated.
const createOtp = async (userId, purpose = 'login', ttlMinutes = OTP_TTL_MIN) => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await pool.query(
    `UPDATE otps SET used = TRUE WHERE user_id = $1 AND purpose = $2 AND used = FALSE`,
    [userId, purpose]
  );
  await pool.query(
    `INSERT INTO otps (id, user_id, code_hash, purpose, expires_at, used)
     VALUES ($1, $2, $3, $4, $5, FALSE)`,
    [id, userId, hashOtp(id, otp), purpose, expiresAt]
  );
  return { id, otp, expiresAt };
};

// Never logs the code in production (mailer prints only in dev with no provider)
const sendOtpEmail = async (toEmail, otp, opts = {}) => {
  const tpl = otpEmail({ code: otp, ttl: opts.ttl || OTP_TTL_MIN });
  await sendEmail({ to: toEmail, ...tpl });
};

const MAIL_FAIL = { message: 'Could not send verification email, try again' };

// Only login/register OTPs are verifiable here; `reset` is handled by its own endpoint.
const verifyOtpRecord = async (id, code) => {
  // Atomically count the attempt; fails when used, expired, or attempts exhausted
  const { rows } = await pool.query(
    `UPDATE otps SET attempts = attempts + 1
     WHERE id = $1 AND purpose IN ('login','register')
       AND used = FALSE AND attempts < $2 AND expires_at > NOW()
     RETURNING *`,
    [id, OTP_MAX_ATTEMPTS]
  );

  if (!rows.length) {
    const { rows: any } = await pool.query(
      `SELECT used, attempts FROM otps WHERE id = $1 AND purpose IN ('login','register')`,
      [id]
    );
    if (any.length && any[0].attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query(`UPDATE otps SET used = TRUE WHERE id = $1`, [id]);
      return { ok: false, reason: 'Too many attempts, request a new code' };
    }
    return { ok: false, reason: 'Code expired or already used, request a new one' };
  }

  const rec = rows[0];
  const expected = rec.code_hash;
  if (!expected || !safeEqualHex(expected, hashOtp(id, code))) {
    if (rec.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query(`UPDATE otps SET used = TRUE WHERE id = $1`, [id]);
      return { ok: false, reason: 'Too many attempts, request a new code' };
    }
    return { ok: false, reason: 'Incorrect code' };
  }

  await pool.query(`UPDATE otps SET used = TRUE WHERE id = $1`, [id]);
  return { ok: true, userId: rec.user_id, purpose: rec.purpose };
};

// ✅ REGISTER — always creates a student; faculty is a *request* approved by an admin
const register = async (req, res) => {
  try {
    const { name, email, password, department, year, role } = req.body;

    if (!emailDomainAllowed(email)) {
      return res.status(400).json({ message: 'Please register with your university email address' });
    }

    const { rows: existing } = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1`,
      [email]
    );
    if (existing.length) return res.status(409).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await pool.query(
      `INSERT INTO users
       (id, name, email, password, role, requested_role, department, year, is_verified)
       VALUES ($1,$2,$3,$4,'student',$5,$6,$7,FALSE)`,
      [id, name, email, hashed, role === 'faculty' ? 'faculty' : null, department || null, year || null]
    );

    const { id: registerId, otp } = await createOtp(id, 'register');
    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr) {
      console.error('OTP email failed:', mailErr.message);
      return res.status(502).json(MAIL_FAIL);
    }

    res.status(201).json({
      otpRequired: true,
      registerId,
      facultyPending: role === 'faculty',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Register error' });
  }
};

// ✅ LOGIN — password is checked before account state is revealed
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { rows } = await pool.query(`SELECT * FROM users WHERE LOWER(email) = $1`, [email]);
    const user = rows[0];

    // Always run a bcrypt compare so timing doesn't reveal whether the email exists
    const hash = user ? user.password : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    const match = await bcrypt.compare(password, hash);
    if (!user || !match) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.is_active) return res.status(403).json({ message: 'Account disabled' });

    if (!user.is_verified) {
      const { id: loginId, otp } = await createOtp(user.id, 'login');
      try {
        await sendOtpEmail(user.email, otp);
      } catch (mailErr) {
        console.error('OTP email failed:', mailErr.message);
        return res.status(502).json(MAIL_FAIL);
      }
      return res.json({ otpRequired: true, loginId });
    }

    const token = generateToken(user);
    delete user.password;
    delete user.token_version;
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login error' });
  }
};

// ✅ VERIFY OTP (purpose comes from the stored record, never the client)
const verifyOtp = async (req, res) => {
  try {
    const { id, code } = req.body;
    const result = await verifyOtpRecord(id, code);
    if (!result.ok) return res.status(400).json({ message: result.reason });

    await pool.query(`UPDATE users SET is_verified = TRUE WHERE id = $1`, [result.userId]);

    const { rows } = await pool.query(
      `SELECT ${PUBLIC_USER_COLS}, token_version FROM users WHERE id=$1`,
      [result.userId]
    );
    const user = rows[0];
    const token = generateToken(user);
    delete user.token_version;
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'OTP error' });
  }
};

// ✅ RESEND OTP — 60s cooldown, max 5/hour per user+purpose
const resendOtp = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, purpose FROM otps WHERE id = $1 AND purpose IN ('login','register')`,
      [req.body.id]
    );
    if (!rows.length) return res.status(400).json({ message: 'Verification session not found, start again' });
    const { user_id, purpose } = rows[0];

    const { rows: stats } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS last_hour,
         EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS since_last
       FROM otps WHERE user_id = $1 AND purpose = $2`,
      [user_id, purpose]
    );
    if (stats[0].since_last !== null && stats[0].since_last < RESEND_COOLDOWN_SEC) {
      return res.status(429).json({
        message: `Please wait ${RESEND_COOLDOWN_SEC - stats[0].since_last}s before requesting another code`,
      });
    }
    if (stats[0].last_hour >= RESEND_MAX_PER_HOUR) {
      return res.status(429).json({ message: 'Too many codes requested, try again later' });
    }

    const { rows: u } = await pool.query(`SELECT email, is_active FROM users WHERE id = $1`, [user_id]);
    if (!u.length || !u[0].is_active) return res.status(400).json({ message: 'Account unavailable' });

    const { id, otp } = await createOtp(user_id, purpose);
    try {
      await sendOtpEmail(u[0].email, otp);
    } catch (mailErr) {
      console.error('OTP email failed:', mailErr.message);
      return res.status(502).json(MAIL_FAIL);
    }
    res.json({ id, loginId: purpose === 'login' ? id : undefined, registerId: purpose === 'register' ? id : undefined });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Resend error' });
  }
};

const getMe = async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id=$1`, [req.user.id]);
  res.json({ user: rows[0] });
};

// ✅ UPDATE PROFILE — only provided fields change; '' clears department/year
const updateProfile = async (req, res) => {
  try {
    const { name, department, year } = req.body;
    const sets = [];
    const params = [];
    const add = (col, val) => { params.push(val); sets.push(`${col}=$${params.length}`); };

    if (name !== undefined) add('name', name);
    if (department !== undefined) add('department', department || null);
    if (year !== undefined) add('year', year || null);

    if (sets.length) {
      params.push(req.user.id);
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=$${params.length}`, params);
    }

    const { rows } = await pool.query(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id=$1`, [req.user.id]);
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Update error' });
  }
};

module.exports = { register, login, verifyOtp, resendOtp, getMe, updateProfile, generateToken };
