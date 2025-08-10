const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const { createResponse } = require('../utils/apiUtils');
const { requireEditor } = require('../middleware/auth');

// GET /api/email-alerts
router.get('/', requireEditor, async (req, res) => {
  try {
    const emailAlerts = await prisma.emailAlert.findMany({
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
router.post('/', requireEditor, async (req, res) => {
  try {
    const { dappId, email, balanceThreshold, isActive } = req.body;

    if (!dappId || !email || balanceThreshold === undefined || isActive === undefined) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: dappId, email, balanceThreshold, isActive");
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
router.put('/', requireEditor, async (req, res) => {
  try {
    const { id, email, balanceThreshold, isActive } = req.body;

    if (!id) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: id");
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
router.delete('/', requireEditor, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return createResponse(res, "BAD_REQUEST", "Missing required fields: id");
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