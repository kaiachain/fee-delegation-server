const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

function getSESClient() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  // Build SES client configuration
  const clientConfig = { region };
  
  // Only include credentials if both are provided (for local development)
  // If not provided, AWS SDK will use IAM roles, instance profiles, or other credential providers
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }
  
  return new SESClient(clientConfig);
}

async function sendEmailWithSES({ from, to, subject, html }) {
  const sesClient = getSESClient();
  
  const command = new SendEmailCommand({
    Source: from,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },
      },
    },
  });

  return await sesClient.send(command);
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
  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error('FROM_EMAIL environment variable not configured');
  }
  
  await sendEmailWithSES({
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
          <p>Your account has been created by an administrator.</p>
          <p>For your first login, please click the button/link below to the login page and <strong>set up your password by selecting "Forgot password?"</strong>.</p>
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

function buildAccountCreatedWithPasswordSetupHtml(resetUrl) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Account Created - Set Your Password</title>
      <style>
        body { margin:0; padding:0; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; color:#111827; }
        .container { max-width:600px; margin:0 auto; background:#ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
        .header { background:#111827; color:#fff; padding:28px 32px; }
        .content { padding:32px; }
        .btn { display:inline-block; background:#10b981; color:#fff !important; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:600; }
        .muted { color:#6b7280; }
        .footer { padding:20px 32px; background:#f3f4f6; color:#6b7280; font-size:12px; }
        .highlight { background:#fef3c7; padding:12px; border-radius:6px; border-left:4px solid #f59e0b; margin:16px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0; font-size:20px;">Welcome to Kaia Fee Delegation</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Your account has been created by an administrator. To get started, you need to set up your password.</p>
          <div class="highlight">
            <p style="margin:0; font-weight:600;">🔑 Set Your Password</p>
            <p style="margin:8px 0 0 0; font-size:14px;">Click the button below to create your password. This link will expire in 7 days.</p>
          </div>
          <p style="margin: 24px 0;">
            <a class="btn" href="${resetUrl}" target="_blank" rel="noopener noreferrer">Set My Password</a>
          </p>
          <p class="muted">If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${resetUrl}</a></p>
          <p class="muted" style="margin-top:24px;">After setting your password, you'll be able to log in to the Kaia Fee Delegation management system.</p>
        </div>
        <div class="footer">
          <p>© 2025 Kaia. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>`;
}

async function sendAccountCreatedEmail({ to, loginUrl }) {
  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error('FROM_EMAIL environment variable not configured');
  }
  
  await sendEmailWithSES({
    from,
    to,
    subject: 'Your account has been created',
    html: buildAccountCreatedHtml(loginUrl)
  });
}

async function sendAccountCreatedWithPasswordSetupEmail({ to, resetUrl }) {
  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error('FROM_EMAIL environment variable not configured');
  }
  
  await sendEmailWithSES({
    from,
    to,
    subject: 'Welcome to Kaia Fee Delegation - Set Your Password',
    html: buildAccountCreatedWithPasswordSetupHtml(resetUrl)
  });
}

module.exports = { 
  sendPasswordResetEmail, 
  sendAccountCreatedEmail, 
  sendAccountCreatedWithPasswordSetupEmail,
  buildPasswordResetHtml, 
  buildAccountCreatedHtml,
  buildAccountCreatedWithPasswordSetupHtml
};


