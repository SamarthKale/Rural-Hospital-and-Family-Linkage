const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: scope query to allowed villages
// ---------------------------------------------------------------------------
async function scopedHouseholdQuery(query, req) {
  if (req.allowedVillageIds !== null) {
    return query.in('village_id', req.allowedVillageIds);
  }
  return query;
}

// ---------------------------------------------------------------------------
// GET /api/households
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { village_id, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('households')
      .select(`
        id, village_id, malaria_number, house_number, address_line,
        location, water_source, construction_type,
        head_of_family_id, created_at, updated_at,
        villages(id, name),
        members(id)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (village_id) {
      query = query.eq('village_id', village_id);
    } else if (req.allowedVillageIds !== null) {
      query = query.in('village_id', req.allowedVillageIds);
    }

    if (search) {
      query = query.or(`malaria_number.ilike.%${search}%,house_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Get head of family names
    const headIds = (data || []).map((h) => h.head_of_family_id).filter(Boolean);
    let headNames = {};
    if (headIds.length > 0) {
      const { data: heads } = await supabase
        .from('members')
        .select('id, full_name')
        .in('id', headIds);
      (heads || []).forEach((h) => { headNames[h.id] = h.full_name; });
    }

    // Get alert counts per household
    const householdIds = (data || []).map((h) => h.id);
    let alertCounts = {};
    if (householdIds.length > 0) {
      const { data: alerts } = await supabase
        .from('alerts')
        .select('member_id, severity, members!inner(household_id)')
        .eq('status', 'active')
        .in('members.household_id', householdIds);

      (alerts || []).forEach((a) => {
        const hid = a.members?.household_id;
        if (hid) {
          if (!alertCounts[hid]) alertCounts[hid] = { count: 0, maxSeverity: 'low' };
          alertCounts[hid].count++;
          const sevOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          if (sevOrder[a.severity] > sevOrder[alertCounts[hid].maxSeverity]) {
            alertCounts[hid].maxSeverity = a.severity;
          }
        }
      });
    }

    const result = (data || []).map((h) => {
      let lat = null, lng = null;
      if (h.location) {
        // PostGIS POINT is returned as GeoJSON by Supabase
        if (typeof h.location === 'object' && h.location.coordinates) {
          [lng, lat] = h.location.coordinates;
        }
      }

      return {
        id: h.id,
        villageId: h.village_id,
        villageName: h.villages?.name,
        malariaNumber: h.malaria_number,
        houseNumber: h.house_number,
        addressLine: h.address_line,
        lat,
        lng,
        waterSource: h.water_source,
        constructionType: h.construction_type,
        headOfFamilyId: h.head_of_family_id,
        headOfFamilyName: headNames[h.head_of_family_id] || null,
        memberCount: (h.members || []).length,
        alertStatus: alertCounts[h.id] || { count: 0, maxSeverity: 'none' },
        createdAt: h.created_at,
      };
    });

    res.json({
      data: result,
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
// POST /api/households
// ---------------------------------------------------------------------------
const createHouseholdSchema = z.object({
  village_id: z.string().uuid('Valid village ID is required'),
  house_number: z.string().optional(),
  address_line: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  water_source: z.string().optional(),
  construction_type: z.string().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = createHouseholdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { village_id, lat, lng, ...rest } = parsed.data;

    // Check village access
    if (req.allowedVillageIds !== null && !req.allowedVillageIds.includes(village_id)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have access to this village.' },
      });
    }

    // Get village short code for malaria number generation
    const { data: village } = await supabase
      .from('villages')
      .select('name')
      .eq('id', village_id)
      .single();

    const villageCode = (village?.name || 'VLG').substring(0, 3).toUpperCase();

    // Get next sequence number for this village
    const { data: existing, count } = await supabase
      .from('households')
      .select('id', { count: 'exact' })
      .eq('village_id', village_id);

    const seq = ((count || 0) + 1).toString().padStart(4, '0');
    const malariaNumber = `${villageCode}-${seq}`;

    // Build insert payload
    const insertData = {
      village_id,
      malaria_number: malariaNumber,
      ...rest,
      created_by: req.user.id,
    };

    // Add GPS point if provided
    if (lat !== undefined && lng !== undefined) {
      insertData.location = `POINT(${lng} ${lat})`;
    }

    const { data, error } = await supabase
      .from('households')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: { code: 'DUPLICATE', message: 'A household with this malaria number already exists.' },
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
// GET /api/households/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const { data: household, error } = await supabase
      .from('households')
      .select(`
        id, village_id, malaria_number, house_number, address_line,
        location, water_source, construction_type,
        head_of_family_id, created_at, updated_at,
        villages(id, name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !household) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Household not found.' },
      });
    }

    // Check village scope
    if (req.allowedVillageIds !== null && !req.allowedVillageIds.includes(household.village_id)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have access to this household.' },
      });
    }

    // Fetch all non-deleted members
    const { data: members } = await supabase
      .from('members')
      .select('id, full_name, date_of_birth, age_years_estimated, gender, phone, blood_group, marital_status, occupation, is_pregnant, is_newborn, has_chronic_illness, is_deleted')
      .eq('household_id', req.params.id)
      .eq('is_deleted', false)
      .order('created_at');

    // Fetch all relationships
    const { data: relationships } = await supabase
      .from('household_relationships')
      .select('id, member_id, related_member_id, relationship_type')
      .eq('household_id', req.params.id);

    let lat = null, lng = null;
    if (household.location && typeof household.location === 'object' && household.location.coordinates) {
      [lng, lat] = household.location.coordinates;
    }

    res.json({
      ...household,
      lat,
      lng,
      members: members || [],
      relationships: relationships || [],
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/households/:id
// ---------------------------------------------------------------------------
const updateHouseholdSchema = z.object({
  house_number: z.string().optional(),
  address_line: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  water_source: z.string().optional(),
  construction_type: z.string().optional(),
  head_of_family_id: z.string().uuid().optional().nullable(),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const parsed = updateHouseholdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { lat, lng, ...rest } = parsed.data;
    const updateData = { ...rest };

    if (lat !== undefined && lng !== undefined) {
      updateData.location = `POINT(${lng} ${lat})`;
    }

    const { data, error } = await supabase
      .from('households')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Household not found.' },
      });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
