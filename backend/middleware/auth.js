const { verify } = require('../utils/verifyToken');
const { createResponse } = require('../utils/apiUtils');

/**
 * Helper function to extract and verify authentication token
 * Returns user info (role, email) or throws error
 *
 * Authentication is Google-only: the ID token is verified against Google's
 * public keys. Only whitelisted accounts on an allowed Google Workspace domain
 * get super_admin; everyone else gets 'viewer', which no route accepts.
 */
const verifyAuthToken = async (token) => {
  if (!token) {
    throw new Error('Authentication token required');
  }

  const google = await verify(token);

  return {
    role: google.role || 'viewer',
    email: google.email,
    provider: 'google',
  };
};

/**
 * Generic role-based authentication middleware
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['super_admin'])
 * @param {string} errorMessage - Custom error message
 * @returns {Function} Express middleware function
 */
const requireRoles = (allowedRoles = ['super_admin'], errorMessage = "You don't have permission to access this resource") => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(" ")[1] : "";

      const userInfo = await verifyAuthToken(token);

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(userInfo.role)) {
        return createResponse(res, "UNAUTHORIZED", errorMessage);
      }

      // Add user info to request for use in route handlers
      req.user = userInfo;
      next();
    } catch (error) {
      console.error("Authentication error:", error);
      return createResponse(res, "UNAUTHORIZED", error.message || "Invalid authentication token");
    }
  };
};

/**
 * Middleware to verify super_admin role only
 */
const requireSuperAdmin = requireRoles(['super_admin'], "Only Super Admin can access this resource");

module.exports = {
  requireRoles,
  requireSuperAdmin,
};
