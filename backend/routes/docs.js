const express = require('express');
const router = express.Router();
const { createResponse } = require('../utils/apiUtils');
const { createSwaggerUI } = require('../utils/swagger');

// Swagger UI is served straight from Express (not Next.js), so the policy in
// next.config.ts never reaches it. It pulls its bundle and stylesheet from
// unpkg.com and bootstraps itself from an inline <script>/<style>, none of
// which a 'self'-only policy permits. "Try it out" posts back to this origin.
const DOCS_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://unpkg.com",
  "connect-src 'self'",
  "worker-src 'self' blob:",
].join('; ');

// GET /api/docs
router.get('/', async (req, res) => {
  try {
    // Return Swagger UI HTML
    const swaggerHtml = createSwaggerUI('/api/openapi.json');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', DOCS_CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(swaggerHtml);
  } catch (error) {
    console.error("Error serving Swagger UI:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to serve documentation");
  }
});

module.exports = router; 