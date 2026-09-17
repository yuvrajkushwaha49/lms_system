const nodemailer = require('nodemailer');

let transporterPromise = null;

function envFirst(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function getSmtpHost() {
  return envFirst('SMTP_HOST', 'MAIL_HOST');
}

function getSmtpPort() {
  return Number(envFirst('SMTP_PORT', 'MAIL_PORT') || 587);
}

function getSmtpUser() {
  // MAIL_UER kept as typo-tolerant alias
  return envFirst('SMTP_USER', 'MAIL_USER', 'MAIL_UER');
}

function getSmtpPass() {
  return envFirst('SMTP_PASS', 'MAIL_PASS');
}

function isMailConfigured() {
  return Boolean(getSmtpHost() && getSmtpUser() && getSmtpPass());
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function getMailFrom() {
  return envFirst('MAIL_FROM', 'SMTP_FROM') || getSmtpUser() || 'noreply@localhost';
}

async function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: getSmtpHost(),
        port: getSmtpPort(),
        secure: String(envFirst('SMTP_SECURE') || 'false').toLowerCase() === 'true',
        auth: {
          user: getSmtpUser(),
          pass: getSmtpPass(),
        },
      }),
    );
  }
  return transporterPromise;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.warn('[mailer] SMTP not configured. Email skipped.', { to, subject, text });
    return { skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: getMailFrom(),
      to,
      subject,
      html,
      text,
    });
    return { skipped: false, messageId: info.messageId };
  } catch (mailError) {
    // Bad SMTP credentials should not break signup / reset flows.
    console.error('[mailer] send failed:', mailError?.message || mailError);
    transporterPromise = null;
    if (text) console.info('[mailer] fallback email body:\n', text);
    return { skipped: true, error: mailError?.message || 'send_failed' };
  }
}

async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const displayName = name || 'there';
  const subject = 'Verify your LMS account email';
  const text = `Hi ${displayName},\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, you can ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p>Hi ${displayName},</p>
      <p>Thanks for creating an account. Please verify your email address to activate login.</p>
      <p style="margin:24px 0">
        <a href="${verifyUrl}" style="background:#453ea8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
          Verify email
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">Or copy this link:<br/><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p style="font-size:13px;color:#6b7280">This link expires in 24 hours.</p>
    </div>
  `;

  const result = await sendMail({ to, subject, html, text });
  if (result.skipped) {
    console.info('[mailer] Verification link (dev):', verifyUrl);
  }
  return { ...result, verifyUrl };
}

async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const displayName = name || 'there';
  const subject = 'Reset your LMS password';
  const text = `Hi ${displayName},\n\nReset your password using this link:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, you can ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px">
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p>Hi ${displayName},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#453ea8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
          Reset password
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">Or copy this link:<br/><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="font-size:13px;color:#6b7280">This link expires in 1 hour.</p>
    </div>
  `;

  const result = await sendMail({ to, subject, html, text });
  if (result.skipped) {
    console.info('[mailer] Password reset link (dev):', resetUrl);
  }
  return { ...result, resetUrl };
}

module.exports = {
  isMailConfigured,
  getFrontendUrl,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
