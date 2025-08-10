const { verify } = require('../utils/verifyToken');
const { createResponse } = require('../utils/apiUtils');

/**
 * Middleware to verify user authentication and role
 * @param {string} requiredRole - The required role ('editor' or 'viewer')
 * @returns {Function} Express middleware function
 */
const requireAuth = (requiredRole = 'editor') => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(" ")[1] : "";
      
      if (!token) {
        const response = createResponse("UNAUTHORIZED", "Authentication token required");
        return res.status(401).json(response);
      }

      const { role } = await verify(token);
      
      if (role !== requiredRole) {
        const response = createResponse("UNAUTHORIZED", "You don't have permission to access this resource");
        return res.status(401).json(response);
      }

      // Add user info to request for use in route handlers
      req.user = { role };
      next();
    } catch (error) {
      console.error("Authentication error:", error);
      const response = createResponse("UNAUTHORIZED", "Invalid authentication token");
      return res.status(401).json(response);
    }
  };
};

/**
 * Middleware to verify editor role specifically
 */
const requireEditor = requireAuth('editor');

/**
 * Middleware to verify any authenticated user
 */
const requireUser = requireAuth('viewer');

module.exports = {
  requireAuth,
  requireEditor,
  requireUser
}; 