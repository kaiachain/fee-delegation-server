const nodemailer = require('nodemailer');

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error('SMTP not configured');
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function buildPasswordResetHtml(resetUrl) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Password Reset</title>
      <style>
        body { margin:0; padding:0; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; color:#111827; }
        .container { max-width:600px; margin:0 auto; background:#ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
        .header { background:#111827; color:#fff; padding:28px 32px; }
        .content { padding:32px; }
        .btn { display:inline-block; background:#2563eb; color:#fff !important; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:600; }
        .muted { color:#6b7280; }
        .footer { padding:20px 32px; background:#f3f4f6; color:#6b7280; font-size:12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0; font-size:20px;">Kaia Fee Delegation – Password Reset</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>You requested to reset your password. Click the button below to set a new password:</p>
          <p style="margin: 24px 0;">
            <a class="btn" href="${resetUrl}" target="_blank" rel="noopener noreferrer">Reset Password</a>
          </p>
          <p class="muted">If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${resetUrl}</a></p>
          <p class="muted" style="margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2025 Kaia. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>`;
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const transporter = getTransport();
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your password',
    html: buildPasswordResetHtml(resetUrl)
  });
}

function buildAccountCreatedHtml(loginUrl) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Account Created</title>
      <style>
        body { margin:0; padding:0; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; color:#111827; }
        .container { max-width:600px; margin:0 auto; background:#ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
        .header { background:#111827; color:#fff; padding:28px 32px; }
        .content { padding:32px; }
        .btn { display:inline-block; background:#10b981; color:#fff !important; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:600; }
        .muted { color:#6b7280; }
        .footer { padding:20px 32px; background:#f3f4f6; color:#6b7280; font-size:12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0; font-size:20px;">Welcome to Kaia Fee Delegation</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Your account has been created by an administrator. You can sign in or set your password using the link below:</p>
          <p style="margin: 24px 0;">
            <a class="btn" href="${loginUrl}" target="_blank" rel="noopener noreferrer">Open Login</a>
          </p>
          <p class="muted">If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${loginUrl}" target="_blank" rel="noopener noreferrer">${loginUrl}</a></p>
        </div>
        <div class="footer">
          <p>© 2025 Kaia. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>`;
}

async function sendAccountCreatedEmail({ to, loginUrl }) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const transporter = getTransport();
  await transporter.sendMail({
    from,
    to,
    subject: 'Your account has been created',
    html: buildAccountCreatedHtml(loginUrl)
  });
}

module.exports = { sendPasswordResetEmail, sendAccountCreatedEmail, buildPasswordResetHtml, buildAccountCreatedHtml };


