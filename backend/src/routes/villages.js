const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: apply village scope to query
// ---------------------------------------------------------------------------
function applyVillageScope(query, req) {
  if (req.allowedVillageIds !== null) {
    return query.in('id', req.allowedVillageIds);
  }
  return query;
}

// ---------------------------------------------------------------------------
// GET /api/states
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  // This handler is mounted at /api/states in index.js
  if (req.baseUrl === '/api/states') {
    try {
      const { data, error } = await supabase
        .from('states')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      next(err);
    }
    return;
  }

  // If mounted at /api/districts
  if (req.baseUrl === '/api/districts') {
    try {
      const stateId = req.query.state_id;
      let query = supabase
        .from('districts')
        .select('id, name, state_id, states(name)')
        .order('name');

      if (stateId) {
        query = query.eq('state_id', stateId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      next(err);
    }
    return;
  }

  // Default: GET /api/villages
  try {
    let query = supabase
      .from('villages')
      .select(`
        id, name, pincode, taluka, district_id, created_at, updated_at,
        districts(id, name, state_id, states(id, name))
      `)
      .order('name');

    query = applyVillageScope(query, req);

    const { data, error } = await query;
    if (error) throw error;

    // Get household and pregnancy counts
    const villageIds = (data || []).map((v) => v.id);
    let householdCounts = {};
    let pregnancyCounts = {};

    if (villageIds.length > 0) {
      const { data: hCounts } = await supabase
        .from('households')
        .select('village_id')
        .in('village_id', villageIds);

      (hCounts || []).forEach((h) => {
        householdCounts[h.village_id] = (householdCounts[h.village_id] || 0) + 1;
      });

      const { data: pCounts } = await supabase
        .from('pregnancies')
        .select('member_id, members!inner(household_id, households!inner(village_id))')
        .in('status', ['registered', 'anc_ongoing']);

      (pCounts || []).forEach((p) => {
        const vid = p.members?.households?.village_id;
        if (vid && villageIds.includes(vid)) {
          pregnancyCounts[vid] = (pregnancyCounts[vid] || 0) + 1;
        }
      });
    }

    const result = (data || []).map((v) => ({
      ...v,
      householdCount: householdCounts[v.id] || 0,
      activePregnancies: pregnancyCounts[v.id] || 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/villages (admin only)
// ---------------------------------------------------------------------------
const createVillageSchema = z.object({
  name: z.string().min(1, 'Village name is required'),
  district_id: z.string().uuid('Valid district ID is required'),
  taluka: z.string().optional(),
  pincode: z.string().length(6, 'Pincode must be 6 digits').optional(),
});

router.post('/', roleGuard('admin'), async (req, res, next) => {
  if (req.baseUrl !== '/api/villages') return next();
  try {
    const parsed = createVillageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { data, error } = await supabase
      .from('villages')
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: { code: 'DUPLICATE', message: 'A village with this name already exists in the district.' },
        });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/villages/:id (admin only)
// ---------------------------------------------------------------------------
const updateVillageSchema = z.object({
  name: z.string().min(1).optional(),
  district_id: z.string().uuid().optional(),
  taluka: z.string().optional(),
  pincode: z.string().length(6).optional(),
});

router.patch('/:id', roleGuard('admin'), async (req, res, next) => {
  if (req.baseUrl !== '/api/villages') return next();
  try {
    const parsed = updateVillageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { data, error } = await supabase
      .from('villages')
      .update(parsed.data)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Village not found.' },
      });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
