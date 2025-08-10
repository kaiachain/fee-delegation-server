const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { requireEditor } = require('../middleware/auth');

// GET /api/email-alert-logs
router.get('/', requireEditor, async (req, res) => {
  try {
    const { dappId, email, isRead } = req.query;

    const whereClause = {};
    
    if (dappId) {
      whereClause.dappId = dappId;
    }
    
    if (email) {
      whereClause.email = email;
    }
    
    if (isRead !== null && isRead !== undefined) {
      whereClause.isRead = isRead === "true";
    }

    const emailAlertLogs = await prisma.emailAlertLog.findMany({
      where: whereClause,
      orderBy: {
        sentAt: 'desc',
      },
    });

    return createResponse(res, "SUCCESS", emailAlertLogs);
  } catch (error) {
    console.error("Error fetching email alert logs:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to fetch email alert logs");
  }
});

module.exports = router; 