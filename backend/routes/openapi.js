const express = require('express');
const router = express.Router();
const { swaggerSpec } = require('../utils/swagger');

// GET /api/openapi.json
router.get('/', async (req, res) => {
  try {
    // Return the Swagger specification directly
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  } catch (error) {
    console.error("Error serving OpenAPI spec:", error);
    res.status(500).json({
      message: "Internal server error",
      error: "Failed to serve OpenAPI specification"
    });
  }
});

module.exports = router; 