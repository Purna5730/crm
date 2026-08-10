"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const requireRole = (...roles) => (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
        res.status(403).json({ message: 'Access denied: insufficient role' });
        return;
    }
    next();
};
exports.requireRole = requireRole;
