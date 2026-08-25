const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const secret = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'default-secret-for-dev-and-test' : null);
    if (!secret) {
      return res.status(500).json({ error: 'JWT_SECRET is not configured' });
    }
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.tenantId) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.tenantId = decoded.tenantId;
    req.userId = decoded.userId || decoded.id || null;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateJWT;