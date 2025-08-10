const express = require('express');
const router = express.Router();
const { createResponse } = require('../utils/apiUtils');
const { createSwaggerUI } = require('../utils/swagger');

// GET /api/docs
router.get('/', async (req, res) => {
  try {
    // Return Swagger UI HTML
    const swaggerHtml = createSwaggerUI('/api/openapi.json');
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerHtml);
  } catch (error) {
    console.error("Error serving Swagger UI:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to serve documentation");
  }
});

module.exports = router; 