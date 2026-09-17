const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { mapDbError, isDbConnectionError } = db;
const { sendVerificationEmail, sendPasswordResetEmail } = require('../shared/mailer');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

async function ensureEmailAuthColumns() {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN (
         'email_verified',
         'email_verification_token',
         'email_verification_expires_at',
         'password_reset_token',
         'password_reset_expires_at'
       )`,
  );
  const existing = new Set((cols || []).map((row) => row.COLUMN_NAME));

  if (!existing.has('email_verified')) {
    await db.query(
      `ALTER TABLE users
       ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1
       AFTER status`,
    );
  }
  if (!existing.has('email_verification_token')) {
    await db.query(
      `ALTER TABLE users
       ADD COLUMN email_verification_token VARCHAR(64) NULL DEFAULT NULL
       AFTER email_verified`,
    );
  }
  if (!existing.has('email_verification_expires_at')) {
    await db.query(
      `ALTER TABLE users
       ADD COLUMN email_verification_expires_at DATETIME NULL DEFAULT NULL
       AFTER email_verification_token`,
    );
  }
  if (!existing.has('password_reset_token')) {
    await db.query(
      `ALTER TABLE users
       ADD COLUMN password_reset_token VARCHAR(64) NULL DEFAULT NULL
       AFTER email_verification_expires_at`,
    );
  }
  if (!existing.has('password_reset_expires_at')) {
    await db.query(
      `ALTER TABLE users
       ADD COLUMN password_reset_expires_at DATETIME NULL DEFAULT NULL
       AFTER password_reset_token`,
    );
  }
}

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function verificationExpiryDate() {
  return new Date(Date.now() + VERIFICATION_TTL_MS);
}

function passwordResetExpiryDate() {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MS);
}

const USER_LOOKUP_SELECT = `
  u.id,
  u.business_id,
  u.role_id,
  u.name,
  u.email,
  u.status,
  u.email_verified,
  u.password_hash,
  r.name AS role_name
`;

async function findUserRow(sql, params) {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

async function findUserByEmailExact(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  return findUserRow(
    `SELECT ${USER_LOOKUP_SELECT}
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE LOWER(TRIM(u.email)) = ?
     LIMIT 1`,
    [normalizedEmail],
  );
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  let user = await findUserByEmailExact(normalizedEmail);
  if (user) return user;

  try {
    user = await findUserRow(
      `SELECT ${USER_LOOKUP_SELECT}
       FROM organizations o
       JOIN users u ON u.business_id = o.id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE LOWER(TRIM(o.contact_email)) = ?
         AND u.status = 'active'
       ORDER BY CASE WHEN r.name = 'CEO' THEN 0 ELSE 1 END, u.id ASC
       LIMIT 1`,
      [normalizedEmail],
    );
    if (user) return user;
  } catch (organizationError) {
    if (organizationError.code !== 'ER_NO_SUCH_TABLE') throw organizationError;
  }

  try {
    user = await findUserRow(
      `SELECT ${USER_LOOKUP_SELECT}
       FROM businesses b
       JOIN users u ON u.business_id = b.id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE LOWER(TRIM(b.email)) = ?
         AND u.status = 'active'
       ORDER BY CASE WHEN r.name = 'CEO' THEN 0 ELSE 1 END, u.id ASC
       LIMIT 1`,
      [normalizedEmail],
    );
    if (user) return user;
  } catch (businessError) {
    if (businessError.code !== 'ER_NO_SUCH_TABLE') throw businessError;
  }

  return null;
}

async function issueAndSendVerification(user, { passwordHash } = {}) {
  const verificationToken = createToken();
  const verificationExpiresAt = verificationExpiryDate();

  if (passwordHash) {
    await db.query(
      `UPDATE users
       SET password_hash = ?,
           email_verification_token = ?,
           email_verification_expires_at = ?
       WHERE id = ?`,
      [passwordHash, verificationToken, verificationExpiresAt, user.id],
    );
  } else {
    await db.query(
      `UPDATE users
       SET email_verification_token = ?,
           email_verification_expires_at = ?
       WHERE id = ?`,
      [verificationToken, verificationExpiresAt, user.id],
    );
  }

  let emailSent = false;
  try {
    const mailResult = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: verificationToken,
    });
    emailSent = !mailResult.skipped;
  } catch (mailError) {
    console.error('issueAndSendVerification mail error:', mailError);
  }

  return emailSent;
}

async function ensureRolesSeeded() {
    await db.query(
      `INSERT INTO roles (name)
       VALUES ('CEO'), ('Admin'), ('Instructor'), ('Student')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    );
}

async function resolveDefaultBusinessId() {
  // For now every new signup attaches to business_id = 1.
  // Override later with DEFAULT_BUSINESS_ID in .env if needed.
  const fromEnv = Number(process.env.DEFAULT_BUSINESS_ID || process.env.DEFAULT_ORG_ID || 1);
  return fromEnv > 0 ? fromEnv : 1;
}

async function ensureStudentRoleId() {
  await ensureRolesSeeded();
  const [roleResult] = await db.query(
    `SELECT id FROM roles WHERE LOWER(TRIM(name)) IN ('student') LIMIT 1`,
  );
  if (!roleResult.length) {
    throw Object.assign(new Error('Student role is missing in roles table.'), { status: 500 });
  }
  return roleResult[0].id;
}

const registerPlatform = async (req, res) => {
  const {
    name,
    full_name,
    ceo_name,
    email,
    contact_email,
    phone,
    password,
  } = req.body || {};

  try {
    const studentName = String(name || full_name || ceo_name || '').trim();
    const studentEmail = String(email || contact_email || '').trim().toLowerCase();
    const studentPhone = phone ? String(phone).trim() : null;

    if (!studentName || !studentEmail || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'name, email and password are required',
      });
    }
    if (String(password).length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters',
      });
    }

    await ensureEmailAuthColumns();

    const existingUser = await findUserByEmailExact(studentEmail);
    if (existingUser) {
      if (Number(existingUser.email_verified) === 1) {
        return res.status(400).json({
          status: 'error',
          code: 'EMAIL_ALREADY_VERIFIED',
          message: 'This email is already registered and verified. Please log in, or use Forgot Password if you need a new password.',
          data: { email: existingUser.email },
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const emailSent = await issueAndSendVerification(existingUser, { passwordHash: hashedPassword });

      return res.status(200).json({
        status: 'success',
        code: 'VERIFICATION_RESENT',
        message: emailSent
          ? 'This email is already registered but not verified. We sent a new verification link — please check your inbox.'
          : 'This email is already registered but not verified. A new verification link was generated — check your inbox or server logs.',
        data: {
          email: existingUser.email,
          email_verification_required: true,
          email_sent: emailSent,
          resent: true,
          role: 'Student',
        },
      });
    }

    // Always attach new student signups to business_id = 1 for now.
    const businessId = 1;
    const studentRoleId = await ensureStudentRoleId();
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = createToken();
    const verificationExpiresAt = verificationExpiryDate();

    try {
      await db.query(
        `INSERT INTO users
          (business_id, role_id, name, email, phone, password_hash, email_verified, email_verification_token, email_verification_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          businessId,
          studentRoleId,
          studentName,
          studentEmail,
          studentPhone,
          hashedPassword,
          verificationToken,
          verificationExpiresAt,
        ],
      );
    } catch (insertError) {
      if (insertError && insertError.code === 'ER_DUP_ENTRY') {
        const racedUser = await findUserByEmailExact(studentEmail);
        if (racedUser && Number(racedUser.email_verified) === 0) {
          const emailSent = await issueAndSendVerification(racedUser, { passwordHash: hashedPassword });
          return res.status(200).json({
            status: 'success',
            code: 'VERIFICATION_RESENT',
            message: emailSent
              ? 'This email is already registered but not verified. We sent a new verification link — please check your inbox.'
              : 'This email is already registered but not verified. A new verification link was generated.',
            data: {
              email: racedUser.email,
              email_verification_required: true,
              email_sent: emailSent,
              resent: true,
              role: 'Student',
            },
          });
        }
        return res.status(400).json({
          status: 'error',
          code: 'EMAIL_ALREADY_VERIFIED',
          message: 'This email is already registered. Please log in or use Forgot Password.',
          data: { email: studentEmail },
        });
      }
      if (insertError && (insertError.code === 'ER_NO_REFERENCED_ROW_2' || insertError.code === 'ER_NO_REFERENCED_ROW')) {
        return res.status(500).json({
          status: 'error',
          message: 'Registration failed: platform organization (business_id=1) is missing. Please contact support.',
        });
      }
      throw insertError;
    }

    let emailSent = false;
    try {
      const mailResult = await sendVerificationEmail({
        to: studentEmail,
        name: studentName,
        token: verificationToken,
      });
      emailSent = !mailResult.skipped;
    } catch (mailError) {
      console.error('registerStudent mail error:', mailError);
    }

    res.status(201).json({
      status: 'success',
      message: emailSent
        ? 'Account created. Please check your email to verify your student account.'
        : 'Account created. Verification email could not be sent yet — use Resend from this page or login.',
      data: {
        email: studentEmail,
        role: 'Student',
        business_id: businessId,
        email_verification_required: true,
        email_sent: emailSent,
      },
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ status: 'error', message: 'Duplicate entry. Email may already be registered.' });
    }
    console.error('registerPlatform error:', error);
    const status = error.status || (isDbConnectionError(error) ? 503 : 500);
    res.status(status).json({ status: 'error', message: error.status ? error.message : mapDbError(error) });
  }
};

const login = async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const { password } = req.body;
  try {
    await ensureEmailAuthColumns();

    const user = await findUserByEmailExact(email);
    if (!user) {
      return res.json({
        status: 'error',
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account is not found. Please create the account.',
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ status: 'error', message: 'This account is inactive. Please contact support.' });
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    if (Number(user.email_verified) === 0) {
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        data: { email: user.email },
      });
    }

    const payload = {
      id: user.id,
      name: user.name || null,
      org_id: user.business_id,
      business_id: user.business_id,
      role_id: user.role_id,
      role_name: user.role_name,
      email: user.email,
    };
    const tokenExpiry = process.env.JWT_EXPIRES_IN || '30d';
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenExpiry });
    res.json({ status: 'success', data: { token, user: payload } });
  } catch (error) {
    console.error('login error:', error?.code || error?.message);
    const status = isDbConnectionError(error) ? 503 : 500;
    res.status(status).json({ status: 'error', message: mapDbError(error) });
  }
};

const verifyEmail = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Verification token is required' });
  }

  try {
    await ensureEmailAuthColumns();

    const [users] = await db.query(
      `SELECT id, email, email_verified, email_verification_expires_at
       FROM users
       WHERE email_verification_token = ?
       LIMIT 1`,
      [token],
    );

    if (!users.length) {
      return res.status(400).json({ status: 'error', message: 'Invalid or already used verification link.' });
    }

    const user = users[0];
    if (Number(user.email_verified) === 1) {
      return res.json({ status: 'success', message: 'Email is already verified. You can log in.' });
    }

    if (user.email_verification_expires_at && new Date(user.email_verification_expires_at).getTime() < Date.now()) {
      return res.status(400).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'This verification link has expired. Please request a new one.',
        data: { email: user.email },
      });
    }

    await db.query(
      `UPDATE users
       SET email_verified = 1,
           email_verification_token = NULL,
           email_verification_expires_at = NULL
       WHERE id = ?`,
      [user.id],
    );

    res.json({
      status: 'success',
      message: 'Email verified successfully. You can now log in.',
      data: { email: user.email },
    });
  } catch (error) {
    console.error('verifyEmail error:', error);
    const status = isDbConnectionError(error) ? 503 : 500;
    res.status(status).json({ status: 'error', message: mapDbError(error) });
  }
};

const resendVerification = async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }

  try {
    await ensureEmailAuthColumns();

    const user = await findUserByEmailExact(email);

    if (!user) {
      return res.json({
        status: 'error',
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account is not found. Please create the account.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: 'This account is inactive. Please contact support.',
      });
    }

    if (Number(user.email_verified) === 1) {
      return res.json({
        status: 'success',
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'This email is already verified. You can log in, or use Forgot Password if needed.',
        data: { already_verified: true, email: user.email },
      });
    }

    const emailSent = await issueAndSendVerification(user);

    res.json({
      status: 'success',
      message: emailSent
        ? 'Verification email sent. Please check your inbox.'
        : 'Verification link generated. SMTP is not configured — check server logs for the link.',
      data: { email_sent: emailSent, email: user.email },
    });
  } catch (error) {
    console.error('resendVerification error:', error);
    const status = isDbConnectionError(error) ? 503 : 500;
    res.status(status).json({ status: 'error', message: mapDbError(error) });
  }
};

const forgotPassword = async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }

  try {
    await ensureEmailAuthColumns();

    const user = await findUserByEmail(email);
    const requestedEmail = email.toLowerCase();

    if (!user) {
      return res.json({
        status: 'error',
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account is not found. Please create the account.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        message: 'This account is inactive. Please contact support.',
      });
    }

    if (Number(user.email_verified) === 0) {
      const emailSent = await issueAndSendVerification(user);
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: emailSent
          ? 'This email is not verified yet. We sent a verification link instead — verify first, then you can reset your password.'
          : 'This email is not verified yet. A verification link was generated — verify first, then use Forgot Password.',
        data: { email: user.email, email_sent: emailSent },
      });
    }

    const resetToken = createToken();
    const resetExpiresAt = passwordResetExpiryDate();

    await db.query(
      `UPDATE users
       SET password_reset_token = ?,
           password_reset_expires_at = ?
       WHERE id = ?`,
      [resetToken, resetExpiresAt, user.id],
    );

    let emailSent = false;
    try {
      const mailResult = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token: resetToken,
      });
      emailSent = !mailResult.skipped;
    } catch (mailError) {
      console.error('forgotPassword mail error:', mailError);
      return res.status(500).json({
        status: 'error',
        message: 'Could not send password reset email. Please try again later.',
      });
    }

    const deliveryEmail = user.email;
    const matchedViaAlias = deliveryEmail.toLowerCase() !== requestedEmail;
    let message = emailSent
      ? 'Password reset link sent. Please check your inbox.'
      : 'Password reset link generated. SMTP is not configured — check server logs for the link.';
    if (matchedViaAlias) {
      message = emailSent
        ? `Password reset link sent to ${deliveryEmail} (your account login email).`
        : `Password reset link generated for ${deliveryEmail}. Check server logs if SMTP is not configured.`;
    }

    res.json({
      status: 'success',
      message,
      data: { email_sent: emailSent, delivery_email: deliveryEmail },
    });
  } catch (error) {
    console.error('forgotPassword error:', error);
    const status = isDbConnectionError(error) ? 503 : 500;
    res.status(status).json({ status: 'error', message: mapDbError(error) });
  }
};

const resetPassword = async (req, res) => {
  const token = String(req.body?.token || req.query?.token || '').trim();
  const password = String(req.body?.password || '');
  const confirmPassword = req.body?.confirm_password;

  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Reset token is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
  }
  if (confirmPassword != null && password !== confirmPassword) {
    return res.status(400).json({ status: 'error', message: 'Password and Confirm Password do not match' });
  }

  try {
    await ensureEmailAuthColumns();

    const [users] = await db.query(
      `SELECT id, email, email_verified, password_reset_expires_at
       FROM users
       WHERE password_reset_token = ?
       LIMIT 1`,
      [token],
    );

    if (!users.length) {
      return res.status(400).json({ status: 'error', message: 'Invalid or already used reset link.' });
    }

    const user = users[0];
    if (Number(user.email_verified) === 0) {
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before resetting the password.',
        data: { email: user.email },
      });
    }

    if (user.password_reset_expires_at && new Date(user.password_reset_expires_at).getTime() < Date.now()) {
      return res.status(400).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'This password reset link has expired. Please request a new one.',
        data: { email: user.email },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE users
       SET password_hash = ?,
           password_reset_token = NULL,
           password_reset_expires_at = NULL
       WHERE id = ?`,
      [hashedPassword, user.id],
    );

    res.json({
      status: 'success',
      message: 'Password updated successfully. You can now log in.',
      data: { email: user.email },
    });
  } catch (error) {
    console.error('resetPassword error:', error);
    const status = isDbConnectionError(error) ? 503 : 500;
    res.status(status).json({ status: 'error', message: mapDbError(error) });
  }
};

module.exports = {
  registerPlatform,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
