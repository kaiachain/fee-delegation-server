const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse, applyDappAccessFilter, hasUserDappAccess } = require('../utils/apiUtils');
const { requireEditorOrSuperAdmin } = require('../middleware/auth');

// GET /api/email-alert-logs
router.get('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { dappId, email, isRead } = req.query;
    const userRole = req.user?.role;
    const userEmail = req.user?.email;

    let whereClause = {};
    
    if (dappId) {
      whereClause.dappId = dappId;
    }
    
    if (email) {
      whereClause.email = email;
    }
    
    if (isRead !== null && isRead !== undefined) {
      whereClause.isRead = isRead === "true";
    }

    // Apply DApp access filtering
    whereClause = await applyDappAccessFilter(whereClause, userRole, userEmail);

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
    const userRole = req.user?.role;
    const userEmail = req.user?.email;

    // Validate request
    if (!id && !dappId && !markAllAsRead) {
      return createResponse(res, "BAD_REQUEST", "Either id, dappId, or markAllAsRead must be provided");
    }

    let result;

    if (markAllAsRead) {
      // Mark all unread logs as read (filtered by user access)
      let markAllWhereClause = { isRead: false };
      markAllWhereClause = await applyDappAccessFilter(markAllWhereClause, userRole, userEmail);
      
      result = await prisma.emailAlertLog.updateMany({
        where: markAllWhereClause,
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
      // Mark specific log as read by ID (with access check)
      let logWhereClause = { id };
      logWhereClause = await applyDappAccessFilter(logWhereClause, userRole, userEmail);
      
      result = await prisma.emailAlertLog.update({
        where: logWhereClause,
        data: { isRead: true }
      });
      
      console.log(`Marked email alert log ${id} as read`);
      return createResponse(res, "SUCCESS", { 
        message: "Email alert log marked as read",
        log: result 
      });
    }

    if (dappId) {
      // Check if user has access to this DApp
      const hasAccess = await hasUserDappAccess(dappId, userRole, userEmail);
      if (!hasAccess) {
        return createResponse(res, "UNAUTHORIZED", "You don't have access to this DApp's email alert logs");
      }
      
      // Mark all logs for a specific DApp as read
      const dappWhereClause = {
        dappId,
        isRead: false
      };
      
      result = await prisma.emailAlertLog.updateMany({
        where: dappWhereClause,
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