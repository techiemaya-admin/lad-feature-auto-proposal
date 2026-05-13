const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
        // Use jwt.decode instead of jwt.verify
        // This does NOT check if the token is real, it just reads the data
        const decoded = jwt.decode(token); 
        
        if (decoded && decoded.tenantId) {
            req.tenantId = decoded.tenantId;
            return next();
        }
    }
    res.status(401).json({ message: "Invalid or unreadable token" });
};
module.exports = authenticateJWT;