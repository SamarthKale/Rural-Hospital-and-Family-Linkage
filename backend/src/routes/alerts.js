const express = require('express');
const supabase = require('../utils/supabaseClient');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/alerts
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { severity, alert_type, village_id, status = 'active', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('alerts')
      .select(`
        id, village_id, member_id, pregnancy_id, alert_type, severity,
        status, title, description, dedup_key,
        acknowledged_by, acknowledged_at, resolved_at, created_at,
        members(id, full_name, household_id),
        villages(id, name)
      `, { count: 'exact' })
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (alert_type) query = query.eq('alert_type', alert_type);

    if (village_id) {
      query = query.eq('village_id', village_id);
    } else if (req.allowedVillageIds !== null) {
      query = query.in('village_id', req.allowedVillageIds);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/alerts/:id/acknowledge
// ---------------------------------------------------------------------------
router.patch('/:id/acknowledge', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: req.user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'active')
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Alert not found or already acknowledged.' },
      });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
