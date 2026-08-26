const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  jwt.verify(token, config.jwtSecret, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired authentication token.' });
    }
    req.user = decodedUser;
    next();
  });
}

function requireRole(allowedRoles = []) {
  if (typeof allowedRoles === 'string') {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

module.exports = { authenticateToken, requireRole };
