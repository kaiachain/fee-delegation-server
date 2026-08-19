const dappsRoutes = require('./routes/dapps');
const contractsRoutes = require('./routes/contracts');
const sendersRoutes = require('./routes/senders');
const { balanceRouter: balanceRoutes, balanceV2Router: balanceV2Routes } = require('./routes/balance');
const apiKeysRoutes = require('./routes/apiKeys');
const poolRoutes = require('./routes/pool');
const emailAlertsRoutes = require('./routes/emailAlerts');
const emailAlertLogsRoutes = require('./routes/emailAlertLogs');
const docsRoutes = require('./routes/docs');
const openapiRoutes = require('./routes/openapi');
const signAsFeePayerRoutes = require('./routes/signAsFeePayer');
const gasFreeSwapKaiaRoutes = require('./routes/gasFreeSwapKaia');

/**
 * Mounts Express API routes on an existing app. Caller owns body-parser and listen().
 */
function mountApiRoutes(server) {
  server.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  server.use('/api/signAsFeePayer', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  server.use('/api/gasFreeSwapKaia', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  server.use('/api/balance', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  server.use('/api/v2/balance', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  server.use('/api/dapps', dappsRoutes);
  server.use('/api/contracts', contractsRoutes);
  server.use('/api/senders', sendersRoutes);
  server.use('/api/balance', balanceRoutes);
  server.use('/api/v2/balance', balanceV2Routes);
  server.use('/api/api-keys', apiKeysRoutes);
  server.use('/api/pool', poolRoutes);
  server.use('/api/email-alerts', emailAlertsRoutes);
  server.use('/api/email-alert-logs', emailAlertLogsRoutes);
  server.use('/api/docs', docsRoutes);
  server.use('/api/openapi.json', openapiRoutes);
  server.use('/api/signAsFeePayer', signAsFeePayerRoutes);
  server.use('/api/gasFreeSwapKaia', gasFreeSwapKaiaRoutes);
  server.use('/api/rpc-urls', require('./routes/rpcUrls'));
}

/**
 * Creates an in-process Express API app for integration tests (json middleware included).
 */
function createApiApp() {
  const express = require('express');
  const server = express();

  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true }));
  mountApiRoutes(server);

  return server;
}

module.exports = { createApiApp, mountApiRoutes };
