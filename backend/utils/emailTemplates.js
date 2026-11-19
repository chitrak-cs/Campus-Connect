const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const otpEmail = ({ code, ttl = 10, heading = 'Your verification code' }) => ({
  subject: `${code} is your Campus Connect code`,
  text: `${heading}: ${code}. It expires in ${ttl} minutes. If you didn't request this, ignore this email.`,
  html: `
<div style="background:#f4f5f7;padding:24px;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="background:#0B1F3A;padding:20px 24px;border-bottom:3px solid #C9A84C;">
      <span style="color:#ffffff;font-size:18px;font-weight:600;">Campus Connect</span>
    </div>
    <div style="padding:28px 24px;text-align:center;color:#0B1F3A;">
      <p style="margin:0 0 16px;font-size:15px;">${esc(heading)}</p>
      <div style="font-family:'DM Mono',Consolas,monospace;font-size:34px;letter-spacing:8px;font-weight:600;">${esc(code)}</div>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Expires in ${esc(ttl)} minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  </div>
</div>`,
});

module.exports = { otpEmail };
