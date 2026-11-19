const nodemailer = require('nodemailer');

const isProd = () => process.env.NODE_ENV === 'production';

/**
 * Send an email.
 * 1. BREVO_API_KEY set  -> Brevo HTTPS API (works on Render free plan)
 * 2. SMTP_* set         -> nodemailer (local use)
 * 3. otherwise          -> print to console, non-production only
 * Throws on failure so callers can return a proper error.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;
  const fromName = process.env.MAIL_FROM_NAME || 'Campus Connect';

  if (process.env.BREVO_API_KEY) {
    if (!fromEmail) throw new Error('MAIL_FROM is not configured');
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo responded ${res.status}: ${body.slice(0, 200)}`);
    }
    return;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const port = parseInt(SMTP_PORT || '587', 10);
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: SMTP_SECURE === 'true' || port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    });
    return;
  }

  if (!isProd()) {
    console.log(`\n[DEV EMAIL] to=${to} subject="${subject}"\n${text}\n`);
    return;
  }

  throw new Error('No email provider configured');
};

module.exports = { sendEmail };
