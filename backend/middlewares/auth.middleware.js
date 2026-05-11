const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ status: 'error', message: 'Token is required' });

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid Token' });
  }
  return next();
};

const authorizeRole = (rolesArray) => {
  return (req, res, next) => {
    if (!req.user || !rolesArray.includes(req.user.role_name)) {
      return res.status(403).json({ status: 'error', message: 'Access Denied: Insufficient Role Permissions' });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRole };
