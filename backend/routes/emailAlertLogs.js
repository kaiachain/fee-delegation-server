const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { requireEditorOrSuperAdmin } = require('../middleware/auth');

// GET /api/email-alert-logs
router.get('/', requireEditorOrSuperAdmin, async (req, res) => {
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

// PUT /api/email-alert-logs - Mark as read
router.put('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { id, dappId, markAllAsRead } = req.body;

    // Validate request
    if (!id && !dappId && !markAllAsRead) {
      return createResponse(res, "BAD_REQUEST", "Either id, dappId, or markAllAsRead must be provided");
    }

    let result;

    if (markAllAsRead) {
      // Mark all unread logs as read
      result = await prisma.emailAlertLog.updateMany({
        where: {
          isRead: false
        },
        data: {
          isRead: true
        }
      });
      
      console.log(`Marked ${result.count} email alert logs as read`);
      return createResponse(res, "SUCCESS", { 
        message: `Marked ${result.count} email alert logs as read`,
        count: result.count 
      });
    }

    if (id) {
      // Mark specific log as read by ID
      result = await prisma.emailAlertLog.update({
        where: { id },
        data: { isRead: true }
      });
      
      console.log(`Marked email alert log ${id} as read`);
      return createResponse(res, "SUCCESS", { 
        message: "Email alert log marked as read",
        log: result 
      });
    }

    if (dappId) {
      // Mark all logs for a specific DApp as read
      result = await prisma.emailAlertLog.updateMany({
        where: {
          dappId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });
      
      console.log(`Marked ${result.count} email alert logs for DApp ${dappId} as read`);
      return createResponse(res, "SUCCESS", { 
        message: `Marked ${result.count} email alert logs for DApp ${dappId} as read`,
        count: result.count 
      });
    }

  } catch (error) {
    console.error("Error marking email alert logs as read:", error);
    return createResponse(res, "INTERNAL_ERROR", `Failed to mark email alert logs as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

module.exports = router; 