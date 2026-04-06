const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');

async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'AUTH_MISSING_TOKEN', message: 'Authorization header with Bearer token is required.' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const userId = decoded.sub;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Token does not contain a valid subject.' },
      });
    }

    const { data: user, error } = await supabase
      .from('platform_users')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: { code: 'AUTH_USER_NOT_FOUND', message: 'No platform user found for this token.' },
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: { code: 'AUTH_USER_INACTIVE', message: 'Your account has been deactivated. Contact an administrator.' },
      });
    }

    req.user = {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Token has expired. Please log in again.' },
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid token.' },
      });
    }
    logger.error('JWT verification failed', { error: err.message });
    return res.status(401).json({
      error: { code: 'AUTH_ERROR', message: 'Authentication failed.' },
    });
  }
}

module.exports = verifyJWT;
