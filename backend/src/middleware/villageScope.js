const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');

async function villageScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication is required.' },
    });
  }

  // Admin has access to all villages
  if (req.user.role === 'admin') {
    req.allowedVillageIds = null; // null means all villages
    return next();
  }

  // TEST_MODE: if mock user is admin, already handled above
  try {
    const { data: assignments, error } = await supabase
      .from('user_village_assignments')
      .select('village_id')
      .eq('user_id', req.user.id);

    if (error) {
      logger.error('Failed to fetch village assignments', { error: error.message, userId: req.user.id });
      return res.status(500).json({
        error: { code: 'VILLAGE_SCOPE_ERROR', message: 'Failed to determine village access.' },
      });
    }

    req.allowedVillageIds = assignments.map((a) => a.village_id);

    if (req.allowedVillageIds.length === 0) {
      logger.warn('User has no village assignments', { userId: req.user.id });
    }

    next();
  } catch (err) {
    logger.error('Village scope middleware error', { error: err.message });
    return res.status(500).json({
      error: { code: 'VILLAGE_SCOPE_ERROR', message: 'Internal error determining village access.' },
    });
  }
}

module.exports = villageScope;
