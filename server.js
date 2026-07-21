const dev = process.env.NODE_ENV !== 'production';

if(!dev) {
  require('dotenv').config({ path: '.env.production' });
}

const express = require('express');
const next = require('next');
const { mountApiRoutes } = require('./backend/createApiApp');

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Handle NextAuth and reCAPTCHA routes with Next.js, before any middleware
  server.all('/api/auth/*', (req, res) => {
    return handle(req, res);
  });
  
  server.all('/api/verify-recaptcha', (req, res) => {
    return handle(req, res);
  });

  // Middleware for other routes
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true }));

  mountApiRoutes(server);

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
