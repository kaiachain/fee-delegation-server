const { verify } = require('../utils/verifyToken');
const { verifyEmailJwt } = require('../utils/passwordUtils');
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

      let role = 'viewer';
      let email = undefined;
      try {
        // Try Google idToken first
        const google = await verify(token);
        role = google.role || 'viewer';
        email = google.email;
      } catch (_) {
        // Fallback to email JWT
        const payload = verifyEmailJwt(token);
        role = payload.role || 'viewer';
        email = payload.email;
      }
      
      // super_admin always passes editor checks
      const passes = role === requiredRole || (requiredRole === 'editor' && role === 'super_admin');
      if (!passes) {
        const response = createResponse("UNAUTHORIZED", "You don't have permission to access this resource");
        return res.status(401).json(response);
      }

      // Add user info to request for use in route handlers
      req.user = { role, email };
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
 * Middleware to verify editor or super_admin role specifically
 */
const requireEditorOrSuperAdmin = requireAuth('editor') || requireAuth('super_admin');

/**
 * Middleware to verify any authenticated user
 */
const requireUser = requireAuth('viewer');

module.exports = {
  requireAuth,
  requireEditor,
  requireEditorOrSuperAdmin,
  requireUser
}; 