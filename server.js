const dev = process.env.NODE_ENV !== 'production';

if(!dev) {
  require('dotenv').config({ path: '.env.production' });
}

const express = require('express');
const next = require('next');
const path = require('path');

const app = next({ dev });
const handle = app.getRequestHandler();

// Import backend routes
const dappsRoutes = require('./backend/routes/dapps');
const contractsRoutes = require('./backend/routes/contracts');
const sendersRoutes = require('./backend/routes/senders');
const balanceRoutes = require('./backend/routes/balance');
const apiKeysRoutes = require('./backend/routes/apiKeys');
const poolRoutes = require('./backend/routes/pool');
const emailAlertsRoutes = require('./backend/routes/emailAlerts');
const emailAlertLogsRoutes = require('./backend/routes/emailAlertLogs');
const docsRoutes = require('./backend/routes/docs');
const openapiRoutes = require('./backend/routes/openapi');
const signAsFeePayerRoutes = require('./backend/routes/signAsFeePayer');

app.prepare().then(() => {
  const server = express();

  // Handle NextAuth routes first, before any middleware
  server.all('/api/auth/*', (req, res) => {
    return handle(req, res);
  });

  // Middleware for other routes
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true }));

  // Health check endpoint for Docker
  server.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // CORS headers only for specific APIs that need external access
  server.use('/api/signAsFeePayer', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  server.use('/api/balance', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  // API Routes (excluding NextAuth which is handled by Next.js)
  server.use('/api/dapps', dappsRoutes);
  server.use('/api/contracts', contractsRoutes);
  server.use('/api/senders', sendersRoutes);
  server.use('/api/balance', balanceRoutes);
  server.use('/api/api-keys', apiKeysRoutes);
  server.use('/api/pool', poolRoutes);
  server.use('/api/email-alerts', emailAlertsRoutes);
  server.use('/api/email-alert-logs', emailAlertLogsRoutes);
  server.use('/api/docs', docsRoutes);
  server.use('/api/openapi.json', openapiRoutes);
  server.use('/api/signAsFeePayer', signAsFeePayerRoutes);
  // Email auth routes
  server.use('/api/email-auth', require('./backend/routes/emailAuth'));
  server.use('/api/users', require('./backend/routes/users'));

  // Handle all other requests with Next.js
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}); 