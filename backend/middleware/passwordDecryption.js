const { decodePassword, isEncodedPassword } = require('../utils/passwordEncryption');

/**
 * Middleware to decode encoded passwords in request body
 * Automatically detects and decodes password fields that were encoded on client-side
 */
const decodePasswords = (req, res, next) => {
  try {
    const { body } = req;
    
    if (!body || typeof body !== 'object') {
      return next();
    }

    // List of password fields to check and decode
    const passwordFields = ['password', 'newPassword', 'oldPassword'];
    
    for (const field of passwordFields) {
      if (body[field] && typeof body[field] === 'string') {
        // Check if the field looks like an encoded password
        if (isEncodedPassword(body[field])) {
          try {
            // Decode the password
            body[field] = decodePassword(body[field]);
            console.log(`Decoded password field: ${field}`);
          } catch (decodeError) {
            console.error(`Failed to decode ${field}:`, decodeError.message);
            // If decoding fails, treat as invalid request
            return res.status(400).json({
              status: false,
              error: 'BAD_REQUEST',
              message: 'Invalid password format',
              data: `Failed to decode ${field}`
            });
          }
        } else {
          // If password is not encoded, log a warning but continue
          // This allows backward compatibility during transition period
          console.warn(`Password field '${field}' was not encoded`);
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Password decoding middleware error:', error);
    return res.status(500).json({
      status: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to process request',
      data: 'Password decoding error'
    });
  }
};

module.exports = { decodePasswords };