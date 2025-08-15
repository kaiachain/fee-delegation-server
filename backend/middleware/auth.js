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
        return createResponse(res, "UNAUTHORIZED", "Authentication token required");
      }

      let role = 'viewer';
      let email = undefined;
      let provider = undefined;
      try {
        // Try Google idToken first
        const google = await verify(token);
        role = google.role || 'viewer';
        email = google.email;
        provider = 'google';
      } catch (_) {
        // Fallback to email JWT
        const payload = verifyEmailJwt(token);
        role = payload.role || 'viewer';
        email = payload.email;
        provider = 'credentials';
      }
      
      // super_admin always passes editor checks
      const passes = role === requiredRole || (requiredRole === 'editor' && role === 'super_admin');
      if (!passes) {
        return createResponse(res, "UNAUTHORIZED", "You don't have permission to access this resource");
      }

      // Add user info to request for use in route handlers
      req.user = { role, email, provider };
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
const requireEditorOrSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : "";
    
    if (!token) {
      return createResponse(res, "UNAUTHORIZED", "Authentication token required");
    }

    let role = 'viewer';
    let email = undefined;
    let provider = undefined;
    
    // Detect token type by checking if it starts with 'ey' (JWT) and has 3 parts
    const isJWT = token.split('.').length === 3;
    
    try {
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
    } catch (error) {
      console.error("Authentication error:", error);
      return createResponse(res, "UNAUTHORIZED", "Invalid authentication token");
    }
    
    // Allow editor and super_admin roles
    if (role !== 'editor' && role !== 'super_admin') {
      return createResponse(res, "UNAUTHORIZED", "You don't have permission to access this resource");
    }

    // Add user info to request for use in route handlers
    req.user = { role, email, provider };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return createResponse(res, "UNAUTHORIZED", "Invalid authentication token");
  }
};

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