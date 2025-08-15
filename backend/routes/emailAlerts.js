const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse, applyDappAccessFilter, validateEmailAlertAccess } = require('../utils/apiUtils');
const { requireEditorOrSuperAdmin } = require('../middleware/auth');

// GET /api/email-alerts
router.get('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userEmail = req.user?.email;
    
    let whereClause = {};
    
    // Apply DApp access filtering
    whereClause = await applyDappAccessFilter(whereClause, userRole, userEmail);

    const emailAlerts = await prisma.emailAlert.findMany({
      where: whereClause,
      include: {
        dapp: {
          select: {
            name: true,
          },
        },
      },
    });

    return createResponse(res, "SUCCESS", emailAlerts);
  } catch (error) {
    console.error("Error fetching email alerts:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to fetch email alerts");
  }
});

// POST /api/email-alerts
router.post('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { dappId, email, balanceThreshold, isActive } = req.body;
    const userRole = req.user?.role;
    const userEmail = req.user?.email;

    if (!dappId || !email || balanceThreshold === undefined || isActive === undefined) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: dappId, email, balanceThreshold, isActive");
    }

    // Check if user has access to this DApp
    if (userRole !== 'super_admin') {
      const userAccess = await prisma.userDappAccess.findFirst({
        where: {
          dappId,
          user: {
            email: userEmail,
            isActive: true
          }
        }
      });
      
      if (!userAccess) {
        return createResponse(res, "UNAUTHORIZED", "You don't have access to this DApp");
      }
    }

    const newEmailAlert = await prisma.emailAlert.create({
      data: {
        dappId,
        email,
        balanceThreshold: balanceThreshold.toString(),
        isActive,
      },
    });

    return createResponse(res, "SUCCESS", newEmailAlert);
  } catch (error) {
    console.error("Error adding email alert:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to add email alert");
  }
});

// PUT /api/email-alerts
router.put('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { id, email, balanceThreshold, isActive } = req.body;
    const userRole = req.user?.role;
    const userEmail = req.user?.email;

    if (!id) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: id");
    }

    // Validate user access to this email alert
    const accessValidation = await validateEmailAlertAccess(id, userRole, userEmail);
    if (!accessValidation.success) {
      const errorType = accessValidation.error === "Email alert not found" ? "BAD_REQUEST" : "UNAUTHORIZED";
      return createResponse(res, errorType, accessValidation.error);
    }

    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (balanceThreshold !== undefined) updateData.balanceThreshold = balanceThreshold.toString();
    if (isActive !== undefined) updateData.isActive = isActive;

    const emailAlert = await prisma.emailAlert.update({
      where: { id },
      data: updateData,
    });

    return createResponse(res, "SUCCESS", emailAlert);
  } catch (error) {
    console.error("Error updating email alert:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to update email alert");
  }
});

// DELETE /api/email-alerts
router.delete('/', requireEditorOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    const userRole = req.user?.role;
    const userEmail = req.user?.email;

    if (!id) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: id");
    }

    // Validate user access to this email alert
    const accessValidation = await validateEmailAlertAccess(id, userRole, userEmail);
    if (!accessValidation.success) {
      const errorType = accessValidation.error === "Email alert not found" ? "BAD_REQUEST" : "UNAUTHORIZED";
      return createResponse(res, errorType, accessValidation.error);
    }

    await prisma.emailAlert.delete({
      where: { id },
    });

    return createResponse(res, "SUCCESS", { message: "Email alert deleted" });
  } catch (error) {
    console.error("Error deleting email alert:", error);
    return createResponse(res, "INTERNAL_ERROR", "Failed to delete email alert");
  }
});

module.exports = router; 