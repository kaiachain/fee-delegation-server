const { verify } = require('../utils/verifyToken');
const { verifyEmailJwt } = require('../utils/passwordUtils');
const { createResponse } = require('../utils/apiUtils');

/**
 * Helper function to extract and verify authentication token
 * Returns user info (role, email, provider) or throws error
 */
const verifyAuthToken = async (token) => {
  if (!token) {
    throw new Error('Authentication token required');
  }

  let role = 'viewer';
  let email = undefined;
  let provider = undefined;
  
  // Detect token type by checking if it starts with 'ey' (JWT) and has 3 parts
  const isJWT = token.split('.').length === 3;
  
  if (isJWT) {
    // Try email JWT first for JWT tokens
    try {
      const payload = verifyEmailJwt(token);
      role = payload.role || 'viewer';
      email = payload.email;
      provider = 'credentials';
    } catch (_) {
      // Fallback to Google verification
      const google = await verify(token);
      role = google.role || 'viewer';
      email = google.email;
      provider = 'google';
    }
  } else {
    // Try Google verification first for non-JWT tokens
    const google = await verify(token);
    role = google.role || 'viewer';
    email = google.email;
    provider = 'google';
  }

  return { role, email, provider };
};

/**
 * Generic role-based authentication middleware
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['editor', 'super_admin'])
 * @param {string} errorMessage - Custom error message
 * @returns {Function} Express middleware function
 */
const requireRoles = (allowedRoles = ['editor', 'super_admin'], errorMessage = "You don't have permission to access this resource") => {
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
 * Middleware to verify user authentication and role
 * @param {string} requiredRole - The required role ('editor' or 'viewer')
 * @returns {Function} Express middleware function
 */
const requireAuth = (requiredRole = 'editor') => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.split(" ")[1] : "";
      
      const userInfo = await verifyAuthToken(token);
      
      // super_admin always passes editor checks
      const passes = userInfo.role === requiredRole || (requiredRole === 'editor' && userInfo.role === 'super_admin');
      if (!passes) {
        return createResponse(res, "UNAUTHORIZED", "You don't have permission to access this resource");
      }

      // Add user info to request for use in route handlers
      req.user = userInfo;
      next();
    } catch (error) {
      console.error("Authentication error:", error);
      return createResponse(res, "UNAUTHORIZED", "Invalid authentication token");
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
const requireEditorOrSuperAdmin = requireRoles(['editor', 'super_admin']);

/**
 * Middleware to verify any authenticated user
 */
const requireUser = requireAuth('viewer');

/**
 * Middleware to verify super_admin role only
 */
const requireSuperAdmin = requireRoles(['super_admin'], "Only Super Admin can access this resource");

module.exports = {
  requireAuth,
  requireEditor,
  requireEditorOrSuperAdmin,
  requireUser,
  requireSuperAdmin
}; 