const nodemailer = require('nodemailer');

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error('SMTP not configured');
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const transporter = getTransport();
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your password',
    html: `<p>Hello,</p><p>Click to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p>`
  });
}

async function sendAccountCreatedEmail({ to, loginUrl }) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const transporter = getTransport();
  await transporter.sendMail({
    from,
    to,
    subject: 'Your account has been created',
    html: `<p>Welcome!</p><p>You can sign in here:</p><p><a href="${loginUrl}">Sign In</a></p>`
  });
}

module.exports = { sendPasswordResetEmail, sendAccountCreatedEmail };


