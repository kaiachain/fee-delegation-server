function validateEmail(req, res, next) {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !/.+@.+\..+/.test(email)) {
    return res.status(400).json({ message: 'Bad request', data: 'Invalid email', error: 'BAD_REQUEST', status: false });
  }
  next();
}

function validatePassword(req, res, next) {
  const { password, newPassword } = req.body || {};
  const candidate = password || newPassword;
  if (!candidate || typeof candidate !== 'string' || candidate.length < 8) {
    return res.status(400).json({ message: 'Bad request', data: 'Weak or missing password', error: 'BAD_REQUEST', status: false });
  }
  next();
}

module.exports = {
  validateEmail,
  validatePassword,
};


