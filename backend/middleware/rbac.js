/**
 * Role-Based Access Control middleware.
 * Usage: router.get('/admin-only', authMiddleware, requireRole('admin'), handler)
 *
 * @param  {...string} roles - Allowed roles (e.g. 'admin', 'business', 'customer')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireRole };
